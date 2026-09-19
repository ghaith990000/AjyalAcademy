-- Ajyal Academy — subscriptions, payments and cancellation. Contract: docs/05-business-rules.md, docs/04-data-model.md
--
-- Every composite write is one function = one transaction. The functions are SECURITY DEFINER (clients have
-- SELECT-only access to these tables) and therefore do their own permission checks:
--   * a coach may only involve their own, non-removed players; an admin may involve any;
--   * a coach sees/changes only subscriptions that contain at least one of their players (can_view_subscription).
-- Errors use the message format 'ajyal:<code>' (see 20260919100000_core_schema.sql); overlap carries the
-- conflicting player ids in DETAIL.

create index subscriptions_discount_idx on public.subscriptions (discount_id) where discount_id is not null;

-- ---------------------------------------------------------------------------
-- "Today" in the academy's timezone (the database runs in UTC; Bahrain is UTC+3)
-- ---------------------------------------------------------------------------
create function public.today_bh()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Bahrain')::date
$$;

revoke all on function public.today_bh() from public, anon;
grant execute on function public.today_bh() to authenticated;

-- ---------------------------------------------------------------------------
-- calc_subscription_total — the authoritative pricing (mirrors src/lib/pricing.ts; both are pinned to the
-- worked examples in docs/05-business-rules.md by tests). Percent discounts are basis points and round half
-- up to the nearest fil; the discount never exceeds the subtotal. Internal: not callable through the API.
-- ---------------------------------------------------------------------------
create function public.calc_subscription_total(
  p_plan_price_fils integer,
  p_tshirt_total_fils integer,
  p_transport_total_fils integer,
  p_discount_type public.discount_type,
  p_discount_value integer
)
returns table (subtotal_fils integer, discount_fils integer, total_fils integer)
language sql
immutable
set search_path = ''
as $$
  with base as (
    select p_plan_price_fils + p_tshirt_total_fils + p_transport_total_fils as subtotal
  ), raw as (
    select
      subtotal,
      case
        when p_discount_type = 'percent' then (subtotal::bigint * p_discount_value + 5000) / 10000
        when p_discount_type = 'fixed' then p_discount_value::bigint
        else 0::bigint
      end as amount
    from base
  )
  select subtotal, least(amount, subtotal)::integer, (subtotal - least(amount, subtotal))::integer
  from raw
$$;

revoke all on function public.calc_subscription_total(integer, integer, integer, public.discount_type, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create function public.subscription_player_names(p_subscription_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.full_name order by p.full_name), '{}')
  from public.subscription_players sp
  join public.players p on p.id = sp.player_id
  where sp.subscription_id = p_subscription_id
$$;

revoke all on function public.subscription_player_names(uuid) from public, anon, authenticated;

-- Insert a payment and log it. The caller has already checked permissions, the balance and the date.
create function public.add_payment_internal(
  p_subscription_id uuid,
  p_amount_fils integer,
  p_method public.payment_method,
  p_paid_at date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total integer;
  v_paid integer;
begin
  insert into public.payments (subscription_id, amount_fils, method, paid_at, note)
  values (p_subscription_id, p_amount_fils, p_method, p_paid_at, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  select total_fils into v_total from public.subscriptions where id = p_subscription_id;
  select coalesce(sum(amount_fils), 0) into v_paid from public.payments where subscription_id = p_subscription_id;

  perform public.log_activity(
    'payment.recorded', 'payment', v_id,
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'amount_fils', p_amount_fils,
      'method', p_method,
      'paid_fils', v_paid,
      'balance_fils', v_total - v_paid,
      'player_names', to_jsonb(public.subscription_player_names(p_subscription_id))
    )
  );
  return v_id;
end;
$$;

revoke all on function public.add_payment_internal(uuid, integer, public.payment_method, date, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_subscription
--   p_players: [{ "player_id": uuid, "transport": bool?, "tshirt": bool? }, …]  (1–4 players; the plan follows)
--     "tshirt" is honoured for admins only; otherwise the fee applies exactly when it is the player's first-ever
--     subscription (cancelled ones count, so cancelling does not re-trigger it).
--   discount: EITHER p_discount_code OR a manual type + value + reason (not both).
--   p_initial_payment_fils: null/0 = unpaid; up to the total. Returns the new subscription id.
-- ---------------------------------------------------------------------------
create function public.create_subscription(
  p_start_date date,
  p_end_date date,
  p_players jsonb,
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
           (e ->> 'tshirt')::boolean as tshirt_override
    from jsonb_array_elements(p_players) e
  loop
    if v_admin and r.tshirt_override is not null then
      v_tshirt := case when r.tshirt_override then v_settings.tshirt_fee_fils else 0 end;
    elsif not exists (select 1 from public.subscription_players where player_id = r.player_id) then
      v_tshirt := v_settings.tshirt_fee_fils;
    else
      v_tshirt := 0;
    end if;
    v_transport := case when r.transport then v_settings.transport_fee_fils else 0 end;
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
    discount_id, discount_type, discount_value, discount_reason, discount_fils, total_fils
  ) values (
    v_plan.id, p_start_date, p_end_date, v_plan.price_fils, v_tshirt_total, v_transport_total,
    v_discount_id, v_type, v_value, case when v_discount_id is null then v_reason end,
    v_calc.discount_fils, v_calc.total_fils
  ) returning id into v_sub;

  insert into public.subscription_players (subscription_id, player_id, tshirt_fee_fils, transport_fee_fils)
  select v_sub, (e ->> 'player_id')::uuid, (e ->> 'tshirt_fee_fils')::integer, (e ->> 'transport_fee_fils')::integer
  from jsonb_array_elements(v_rows) e;

  v_names := public.subscription_player_names(v_sub);
  v_summary := jsonb_build_object(
    'player_names', to_jsonb(v_names),
    'plan', v_plan.code,
    'total_fils', v_calc.total_fils,
    'discount_fils', v_calc.discount_fils
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

revoke all on function public.create_subscription(
  date, date, jsonb, text, public.discount_type, integer, text, integer, public.payment_method, text
) from public, anon;
grant execute on function public.create_subscription(
  date, date, jsonb, text, public.discount_type, integer, text, integer, public.payment_method, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- record_payment — adds a payment; the balance can never go below zero.
-- ---------------------------------------------------------------------------
create function public.record_payment(
  p_subscription_id uuid,
  p_amount_fils integer,
  p_method public.payment_method default 'cash',
  p_paid_at date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.today_bh();
  v_sub public.subscriptions;
  v_paid integer;
  v_date date := coalesce(p_paid_at, public.today_bh());
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if not public.can_view_subscription(p_subscription_id) then
    raise exception 'ajyal:subscription_not_found' using errcode = 'P0002';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if v_sub.cancelled_at is not null then
    raise exception 'ajyal:subscription_cancelled' using errcode = '55000';
  end if;
  if p_amount_fils is null or p_amount_fils <= 0 then
    raise exception 'ajyal:invalid_amount' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'ajyal:invalid_date' using errcode = '22023';
  end if;

  select coalesce(sum(amount_fils), 0) into v_paid from public.payments where subscription_id = p_subscription_id;
  if v_paid + p_amount_fils > v_sub.total_fils then
    raise exception 'ajyal:overpayment' using errcode = '22003';
  end if;

  return public.add_payment_internal(p_subscription_id, p_amount_fils, p_method, v_date, p_note);
end;
$$;

revoke all on function public.record_payment(uuid, integer, public.payment_method, date, text) from public, anon;
grant execute on function public.record_payment(uuid, integer, public.payment_method, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_subscription — soft cancel with a required reason. Payments are kept (no refunds in scope).
-- ---------------------------------------------------------------------------
create function public.cancel_subscription(p_subscription_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if not public.can_view_subscription(p_subscription_id) then
    raise exception 'ajyal:subscription_not_found' using errcode = 'P0002';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if v_sub.cancelled_at is not null then
    raise exception 'ajyal:already_cancelled' using errcode = '55000';
  end if;
  if v_reason is null then
    raise exception 'ajyal:reason_required' using errcode = '22023';
  end if;

  update public.subscriptions
  set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason
  where id = p_subscription_id;

  perform public.log_activity(
    'subscription.cancelled', 'subscription', p_subscription_id,
    jsonb_build_object(
      'player_names', to_jsonb(public.subscription_player_names(p_subscription_id)),
      'reason', v_reason,
      'total_fils', v_sub.total_fils
    )
  );
end;
$$;

revoke all on function public.cancel_subscription(uuid, text) from public, anon;
grant execute on function public.cancel_subscription(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Read models. security_invoker: the caller's RLS applies to the underlying tables, so a coach only gets
-- subscriptions with one of their players, and `player_names` lists only the players they may see.
-- ---------------------------------------------------------------------------
create view public.subscription_overview with (security_invoker = true) as
select
  s.*,
  pl.code as plan_code,
  coalesce(pay.paid_fils, 0)::integer as paid_fils,
  (s.total_fils - coalesce(pay.paid_fils, 0))::integer as balance_fils,
  case
    when s.cancelled_at is not null then 'cancelled'
    when t.today < s.start_date then 'upcoming'
    when t.today > s.end_date then 'expired'
    when (s.end_date - t.today) <= (select st.expiring_soon_days from public.settings st) then 'expiring_soon'
    else 'active'
  end as status,
  names.player_names,
  cnt.player_count
from public.subscriptions s
join public.plans pl on pl.id = s.plan_id
cross join (select public.today_bh() as today) t
left join lateral (
  select sum(p.amount_fils) as paid_fils from public.payments p where p.subscription_id = s.id
) pay on true
left join lateral (
  select string_agg(pp.full_name, ', ' order by pp.full_name) as player_names
  from public.subscription_players sp join public.players pp on pp.id = sp.player_id
  where sp.subscription_id = s.id
) names on true
left join lateral (
  select count(*)::integer as player_count from public.subscription_players sp where sp.subscription_id = s.id
) cnt on true;

-- One row per player: the subscription that best describes them today (current, else upcoming, else latest).
create view public.player_subscription_status with (security_invoker = true) as
select distinct on (sp.player_id)
  sp.player_id, so.id as subscription_id, so.status, so.start_date, so.end_date
from public.subscription_players sp
join public.subscription_overview so on so.id = sp.subscription_id
where so.status <> 'cancelled'
order by
  sp.player_id,
  case so.status when 'active' then 1 when 'expiring_soon' then 1 when 'upcoming' then 2 else 3 end,
  so.end_date desc;

grant select on public.subscription_overview, public.player_subscription_status to authenticated;
