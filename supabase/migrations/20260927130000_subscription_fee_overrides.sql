-- Ajyal Academy — Phase 12: per-player T-shirt/transport fee overrides.
--
-- Some players have a special arrangement (a sibling discount, a scholarship, staff's child) — an admin may
-- now type a different T-shirt and/or transport fee for a player in `create_subscription`, one subscription
-- at a time (nothing is remembered afterward; the next subscription for that player uses the standard fee
-- again unless the admin types one in again). `p_players` gains two optional keys per entry:
-- `tshirt_fee_fils`, `transport_fee_fils` — honoured for admins only (the existing `tshirt`/`transport`
-- booleans still decide *whether* the fee applies; these decide *how much*, replacing the Settings amount for
-- that one player, that one subscription). A coach's academy fees are always the standard ones (D-048).
--
-- New error code (`ajyal:<code>`): invalid_fee (a negative override amount).

create or replace function public.create_subscription(
  p_start_date date,
  p_end_date date,
  p_players jsonb,
  p_location_id uuid,
  p_discount_code text default null,
  p_manual_discount_type public.discount_type default null,
  p_manual_discount_value integer default null,
  p_manual_discount_reason text default null,
  p_initial_payment_fils integer default null,
  p_payment_method public.payment_method default 'cash',
  p_payment_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_today date := public.today_bh();
  v_ids uuid[];
  v_count integer;
  v_found integer;
  v_plan public.plans;
  v_settings public.settings;
  v_discount public.discounts;
  v_location public.locations;
  v_type public.discount_type;
  v_value integer;
  v_reason text;
  v_discount_id uuid;
  v_code text := nullif(trim(coalesce(p_discount_code, '')), '');
  v_conflicts uuid[];
  v_rows jsonb := '[]'::jsonb;
  v_tshirt_total integer := 0;
  v_transport_total integer := 0;
  v_calc record;
  v_sub uuid;
  v_names text[];
  v_summary jsonb;
  r record;
  v_tshirt integer;
  v_transport integer;
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;

  -- players ---------------------------------------------------------------
  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception 'ajyal:invalid_players' using errcode = '22023';
  end if;
  begin
    select array_agg((e ->> 'player_id')::uuid) into v_ids from jsonb_array_elements(p_players) e;
  exception when invalid_text_representation then
    raise exception 'ajyal:invalid_players' using errcode = '22023';
  end;
  v_count := coalesce(cardinality(v_ids), 0);
  if v_count not between 1 and 4
     or array_position(v_ids, null) is not null
     or (select count(distinct x) from unnest(v_ids) x) <> v_count then
    raise exception 'ajyal:invalid_players' using errcode = '22023';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'ajyal:invalid_dates' using errcode = '22023';
  end if;

  -- location --------------------------------------------------------------
  if p_location_id is null then
    raise exception 'ajyal:location_required' using errcode = '22023';
  end if;
  select * into v_location from public.locations where id = p_location_id and active;
  if not found then
    raise exception 'ajyal:invalid_location' using errcode = '22023';
  end if;

  -- Serialise concurrent subscriptions for the same players (overlap check + first-time fee).
  perform 1 from public.players where id = any (v_ids) order by id for update;

  select count(*) into v_found from public.players
  where id = any (v_ids) and deleted_at is null and (v_admin or coach_id = auth.uid());
  if v_found <> v_count then
    raise exception 'ajyal:player_not_found' using errcode = 'P0002';
  end if;

  select * into v_plan from public.plans where player_count = v_count and active;
  if not found then
    raise exception 'ajyal:plan_unavailable' using errcode = '22023';
  end if;

  -- overlap ---------------------------------------------------------------
  select array_agg(distinct sp.player_id) into v_conflicts
  from public.subscription_players sp
  join public.subscriptions s on s.id = sp.subscription_id
  where sp.player_id = any (v_ids)
    and s.cancelled_at is null
    and s.start_date <= p_end_date
    and s.end_date >= p_start_date;
  if v_conflicts is not null then
    raise exception 'ajyal:overlap' using errcode = '23P01', detail = array_to_string(v_conflicts, ',');
  end if;

  -- fees ------------------------------------------------------------------
  select * into v_settings from public.settings;
  for r in
    select (e ->> 'player_id')::uuid as player_id,
           coalesce((e ->> 'transport')::boolean, false) as transport,
           (e ->> 'tshirt')::boolean as tshirt_override,
           (e ->> 'tshirt_fee_fils')::integer as tshirt_fee_override,
           (e ->> 'transport_fee_fils')::integer as transport_fee_override
    from jsonb_array_elements(p_players) e
  loop
    if v_admin and (
      (r.tshirt_fee_override is not null and r.tshirt_fee_override < 0)
      or (r.transport_fee_override is not null and r.transport_fee_override < 0)
    ) then
      raise exception 'ajyal:invalid_fee' using errcode = '22023';
    end if;

    if v_admin and r.tshirt_override is not null then
      v_tshirt := case
        when r.tshirt_override then coalesce(r.tshirt_fee_override, v_settings.tshirt_fee_fils)
        else 0
      end;
    elsif not exists (select 1 from public.subscription_players where player_id = r.player_id) then
      v_tshirt := case
        when v_admin then coalesce(r.tshirt_fee_override, v_settings.tshirt_fee_fils)
        else v_settings.tshirt_fee_fils
      end;
    else
      v_tshirt := 0;
    end if;

    v_transport := case
      when not r.transport then 0
      when v_admin then coalesce(r.transport_fee_override, v_settings.transport_fee_fils)
      else v_settings.transport_fee_fils
    end;

    v_tshirt_total := v_tshirt_total + v_tshirt;
    v_transport_total := v_transport_total + v_transport;
    v_rows := v_rows || jsonb_build_object(
      'player_id', r.player_id, 'tshirt_fee_fils', v_tshirt, 'transport_fee_fils', v_transport
    );
  end loop;

  -- discount (one source only) --------------------------------------------
  if v_code is not null and p_manual_discount_type is not null then
    raise exception 'ajyal:discount_conflict' using errcode = '22023';
  end if;

  if v_code is not null then
    select * into v_discount from public.discounts where lower(code) = lower(v_code) for update;
    if not found then
      raise exception 'ajyal:discount_not_found' using errcode = 'P0002';
    end if;
    if not v_discount.active then
      raise exception 'ajyal:discount_inactive' using errcode = '22023';
    end if;
    if v_discount.valid_from is not null and v_discount.valid_from > v_today then
      raise exception 'ajyal:discount_not_started' using errcode = '22023';
    end if;
    if v_discount.valid_to is not null and v_discount.valid_to < v_today then
      raise exception 'ajyal:discount_expired' using errcode = '22023';
    end if;
    if v_discount.max_uses is not null and (
      select count(*) from public.subscriptions where discount_id = v_discount.id and cancelled_at is null
    ) >= v_discount.max_uses then
      raise exception 'ajyal:discount_exhausted' using errcode = '22023';
    end if;
    v_discount_id := v_discount.id;
    v_type := v_discount.type;
    v_value := v_discount.value;
  elsif p_manual_discount_type is not null then
    v_reason := nullif(trim(coalesce(p_manual_discount_reason, '')), '');
    if v_reason is null then
      raise exception 'ajyal:manual_discount_reason_required' using errcode = '22023';
    end if;
    if p_manual_discount_value is null
       or (p_manual_discount_type = 'percent' and p_manual_discount_value not between 1 and 10000)
       or (p_manual_discount_type = 'fixed' and p_manual_discount_value <= 0) then
      raise exception 'ajyal:manual_discount_invalid' using errcode = '22023';
    end if;
    v_type := p_manual_discount_type;
    v_value := p_manual_discount_value;
  elsif p_manual_discount_value is not null then
    raise exception 'ajyal:manual_discount_invalid' using errcode = '22023';
  end if;

  select * into v_calc from public.calc_subscription_total(
    v_plan.price_fils, v_tshirt_total, v_transport_total, v_type, v_value
  );

  if coalesce(p_initial_payment_fils, 0) < 0 or coalesce(p_initial_payment_fils, 0) > v_calc.total_fils then
    raise exception 'ajyal:overpayment' using errcode = '22003';
  end if;

  -- write -----------------------------------------------------------------
  insert into public.subscriptions (
    plan_id, start_date, end_date, plan_price_fils, tshirt_total_fils, transport_total_fils,
    discount_id, discount_type, discount_value, discount_reason, discount_fils, total_fils, location_id
  ) values (
    v_plan.id, p_start_date, p_end_date, v_plan.price_fils, v_tshirt_total, v_transport_total,
    v_discount_id, v_type, v_value, case when v_discount_id is null then v_reason end,
    v_calc.discount_fils, v_calc.total_fils, v_location.id
  ) returning id into v_sub;

  insert into public.subscription_players (subscription_id, player_id, tshirt_fee_fils, transport_fee_fils)
  select v_sub, (e ->> 'player_id')::uuid, (e ->> 'tshirt_fee_fils')::integer, (e ->> 'transport_fee_fils')::integer
  from jsonb_array_elements(v_rows) e;

  v_names := public.subscription_player_names(v_sub);
  v_summary := jsonb_build_object(
    'player_names', to_jsonb(v_names),
    'plan', v_plan.code,
    'total_fils', v_calc.total_fils,
    'discount_fils', v_calc.discount_fils,
    'location_name', v_location.name
  );
  if v_discount_id is not null then
    v_summary := v_summary || jsonb_build_object('discount_code', v_discount.code);
  elsif v_reason is not null then
    v_summary := v_summary || jsonb_build_object('discount_reason', v_reason);
  end if;
  perform public.log_activity('subscription.created', 'subscription', v_sub, v_summary);

  if coalesce(p_initial_payment_fils, 0) > 0 then
    perform public.add_payment_internal(v_sub, p_initial_payment_fils, p_payment_method, v_today, p_payment_note);
  end if;

  return v_sub;
end;
$$;
