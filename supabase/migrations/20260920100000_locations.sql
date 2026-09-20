-- Ajyal Academy — Phase 9: locations. Contract: docs/04-data-model.md ("As built (Phase 9)"), docs/08-decisions.md D-084…D-087.
--
--   * `locations`: created by admins, readable by every signed-in user, switched off (never deleted).
--   * sessions, subscriptions, expenses and players get an optional-in-the-schema `location_id`; the RULES below make
--     it required where money or the timetable depends on it (new sessions, new subscriptions).
--   * the old free-text `training_sessions.location` is migrated (one location per distinct name) and dropped.
--   * the report functions take an optional location, and `report_by_location` splits a period by location.
--   Payments have no location of their own: they inherit their subscription's (D-085).
-- Errors use the message format 'ajyal:<code>'.

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  address text check (address is null or length(address) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index locations_name_key on public.locations (lower(trim(name)));

alter table public.locations enable row level security;

create policy locations_select on public.locations for select to authenticated
  using (public.is_active_user());
create policy locations_insert on public.locations for insert to authenticated
  with check (public.is_admin());
create policy locations_update on public.locations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.locations to authenticated;
grant insert (name, address, active), update (name, address, active) on public.locations to authenticated;

-- ---------------------------------------------------------------------------
-- training_sessions: free text → location_id
-- ---------------------------------------------------------------------------
alter table public.training_sessions add column location_id uuid references public.locations (id);
create index training_sessions_location_idx on public.training_sessions (location_id) where location_id is not null;

-- One location per distinct name, compared trimmed and case-insensitively.
insert into public.locations (name)
select distinct on (lower(trim(location))) trim(location)
from public.training_sessions
where trim(coalesce(location, '')) <> ''
order by lower(trim(location)), trim(location);

-- A cancelled session is read-only by design (trg_sessions_guard), so the guard is switched off for this one
-- statement and back on straight after; the whole migration is one transaction, so a failure restores everything.
alter table public.training_sessions disable trigger sessions_guard;
update public.training_sessions s
set location_id = l.id
from public.locations l
where trim(coalesce(s.location, '')) <> '' and lower(trim(s.location)) = lower(trim(l.name));
alter table public.training_sessions enable trigger sessions_guard;

do $$
begin
  if exists (
    select 1 from public.training_sessions
    where trim(coalesce(location, '')) <> '' and location_id is null
  ) then
    raise exception 'location backfill incomplete';
  end if;
end $$;

-- The activity trigger is created AFTER the backfill above, so migrating does not write one "location added" entry
-- per migrated name (nobody added them by hand).
create function public.trg_locations_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'location.created', 'location', new.id,
      jsonb_build_object('location_name', new.name)
    );
  elsif to_jsonb(new) is distinct from to_jsonb(old) then
    perform public.log_activity(
      'location.updated', 'location', new.id,
      jsonb_build_object('location_name', new.name, 'previous_name', old.name, 'active', new.active)
    );
  end if;
  return null;
end;
$$;

create trigger locations_activity after insert or update on public.locations
  for each row execute function public.trg_locations_activity();

-- The attendance view exposed the text column: rebuild it around the location instead.
drop view public.player_attendance;
alter table public.training_sessions drop column location;

create view public.player_attendance with (security_invoker = true) as
select
  a.player_id,
  a.session_id,
  a.status,
  a.marked_at,
  s.session_date,
  s.start_time,
  s.end_time,
  s.location_id,
  l.name as location_name,
  s.coach_id
from public.attendance a
join public.training_sessions s on s.id = a.session_id
left join public.locations l on l.id = s.location_id
where s.cancelled_at is null;

grant select on public.player_attendance to authenticated;

-- Sessions: a new session needs an active location; an existing one may keep an inactive location (or, before
-- this migration's data was labelled, none) but cannot be moved to an inactive one or lose it.
create or replace function public.trg_sessions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.cancelled_at := null;
  else
    if old.cancelled_at is not null then
      raise exception 'ajyal:session_cancelled' using errcode = '55000';
    end if;
    new.created_by := old.created_by;
    if new.cancelled_at is not null then
      new.cancelled_at := now();
    end if;
  end if;

  if tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id then
    if not exists (
      select 1 from public.profiles where id = new.coach_id and role = 'coach' and active
    ) then
      raise exception 'ajyal:invalid_coach' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' or new.location_id is distinct from old.location_id then
    if new.location_id is null then
      raise exception 'ajyal:location_required' using errcode = '23514';
    end if;
    if not exists (select 1 from public.locations where id = new.location_id and active) then
      raise exception 'ajyal:invalid_location' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.coach_id is distinct from old.coach_id
     and exists (select 1 from public.attendance where session_id = old.id) then
    raise exception 'ajyal:session_has_attendance' using errcode = '55000';
  end if;

  return new;
end;
$$;

-- The feed sentence for a new session names the location.
create or replace function public.trg_sessions_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_name text;
begin
  select full_name into v_coach_name from public.profiles where id = new.coach_id;

  if tg_op = 'INSERT' then
    perform public.log_activity(
      'session.created', 'session', new.id,
      jsonb_build_object(
        'session_date', new.session_date,
        'start_time', new.start_time,
        'end_time', new.end_time,
        'coach_name', v_coach_name,
        'location_name', (select l.name from public.locations l where l.id = new.location_id)
      )
    );
  elsif old.cancelled_at is null and new.cancelled_at is not null then
    perform public.log_activity(
      'session.cancelled', 'session', new.id,
      jsonb_build_object('session_date', new.session_date, 'coach_name', v_coach_name)
    );
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- players: an optional location label (must be active when set or changed)
-- ---------------------------------------------------------------------------
alter table public.players add column location_id uuid references public.locations (id);
create index players_location_idx on public.players (location_id) where location_id is not null and deleted_at is null;

create or replace function public.trg_players_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  constrained boolean := auth.uid() is not null and not public.is_admin();
begin
  if new.date_of_birth >= current_date then
    raise exception 'ajyal:dob_in_future' using errcode = '23514';
  end if;

  if new.location_id is not null and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    if not exists (select 1 from public.locations where id = new.location_id and active) then
      raise exception 'ajyal:invalid_location' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if constrained then
      new.coach_id := auth.uid();
    end if;
    new.deleted_at := null;
    new.deleted_by := null;
  else
    if constrained then
      if new.coach_id is distinct from old.coach_id then
        raise exception 'ajyal:only_admin_can_reassign' using errcode = '42501';
      end if;
      if old.deleted_at is not null and new.deleted_at is null then
        raise exception 'ajyal:only_admin_can_restore' using errcode = '42501';
      end if;
      new.created_by := old.created_by;
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_by := auth.uid();
    elsif new.deleted_at is null then
      new.deleted_by := null;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- expenses: an optional location (none = academy-wide)
-- ---------------------------------------------------------------------------
alter table public.expenses add column location_id uuid references public.locations (id);
create index expenses_location_idx on public.expenses (location_id) where location_id is not null;

create or replace function public.trg_expenses_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;

  if (tg_op = 'INSERT' or new.expense_date is distinct from old.expense_date)
     and new.expense_date > public.today_bh() then
    raise exception 'ajyal:future_date' using errcode = '23514';
  end if;

  if new.coach_id is not null and (tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id) then
    if not exists (select 1 from public.profiles where id = new.coach_id and role = 'coach') then
      raise exception 'ajyal:invalid_coach' using errcode = '23514';
    end if;
  end if;

  if new.location_id is not null and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    if not exists (select 1 from public.locations where id = new.location_id and active) then
      raise exception 'ajyal:invalid_location' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- subscriptions: one location each (required for new ones; older ones stay empty until an admin sets it)
-- ---------------------------------------------------------------------------
alter table public.subscriptions add column location_id uuid references public.locations (id);
create index subscriptions_location_idx on public.subscriptions (location_id) where location_id is not null;

-- The views read `s.*`, which is fixed when the view is created: rebuild them to pick the new column up.
drop view public.player_subscription_status;
drop view public.subscription_overview;

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
  cnt.player_count,
  loc.name as location_name
from public.subscriptions s
join public.plans pl on pl.id = s.plan_id
left join public.locations loc on loc.id = s.location_id
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

-- create_subscription: the same function as before with a required location right after the players.
drop function public.create_subscription(
  date, date, jsonb, text, public.discount_type, integer, text, integer, public.payment_method, text
);

create function public.create_subscription(
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

revoke all on function public.create_subscription(
  date, date, jsonb, uuid, text, public.discount_type, integer, text, integer, public.payment_method, text
) from public, anon;
grant execute on function public.create_subscription(
  date, date, jsonb, uuid, text, public.discount_type, integer, text, integer, public.payment_method, text
) to authenticated;

-- set_subscription_location — admin only. Labels an older subscription or corrects a mistake; it moves the
-- subscription's whole collected money between locations, so it is logged with both names.
create function public.set_subscription_location(p_subscription_id uuid, p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_location public.locations;
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'ajyal:subscription_not_found' using errcode = 'P0002';
  end if;

  if p_location_id is null then
    raise exception 'ajyal:location_required' using errcode = '22023';
  end if;
  select * into v_location from public.locations where id = p_location_id and active;
  if not found then
    raise exception 'ajyal:invalid_location' using errcode = '22023';
  end if;

  if v_sub.location_id is not distinct from p_location_id then
    return;
  end if;

  update public.subscriptions set location_id = p_location_id where id = p_subscription_id;

  perform public.log_activity(
    'subscription.location_changed', 'subscription', p_subscription_id,
    jsonb_build_object(
      'player_names', to_jsonb(public.subscription_player_names(p_subscription_id)),
      'from_location_name', (select l.name from public.locations l where l.id = v_sub.location_id),
      'to_location_name', v_location.name
    )
  );
end;
$$;

revoke all on function public.set_subscription_location(uuid, uuid) from public, anon;
grant execute on function public.set_subscription_location(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: an optional location (null = every location). A location's figures are the payments on ITS
-- subscriptions and ITS expenses; academy-wide expenses (no location) belong to no single location.
-- ---------------------------------------------------------------------------
drop function public.report_summary(date, date);
drop function public.revenue_by_month(integer);
drop function public.expenses_by_category(date, date);

create function public.report_summary(p_from date, p_to date, p_location_id uuid default null)
returns table (collected_fils bigint, expenses_fils bigint, profit_fils bigint, margin_bps integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;

  return query
  with c as (
    select coalesce(sum(pay.amount_fils), 0)::bigint as v
    from public.payments pay
    join public.subscriptions sub on sub.id = pay.subscription_id
    where pay.paid_at between p_from and p_to
      and (p_location_id is null or sub.location_id = p_location_id)
  ), e as (
    select coalesce(sum(exp.amount_fils), 0)::bigint as v
    from public.expenses exp
    where exp.expense_date between p_from and p_to
      and (p_location_id is null or exp.location_id = p_location_id)
  )
  select
    c.v,
    e.v,
    c.v - e.v,
    case when c.v = 0 then null else round((c.v - e.v)::numeric * 10000 / c.v)::integer end
  from c, e;
end;
$$;

create function public.revenue_by_month(p_year integer, p_location_id uuid default null)
returns table (month_start date, collected_fils bigint, expenses_fils bigint, profit_fils bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_first date;
  v_after date;
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if p_year is null or p_year not between 2000 and 2100 then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;
  v_first := make_date(p_year, 1, 1);
  v_after := make_date(p_year + 1, 1, 1);

  return query
  select
    make_date(p_year, m.n, 1),
    coalesce(pay.v, 0)::bigint,
    coalesce(exp.v, 0)::bigint,
    (coalesce(pay.v, 0) - coalesce(exp.v, 0))::bigint
  from generate_series(1, 12) as m (n)
  left join (
    select extract(month from p.paid_at)::integer as n, sum(p.amount_fils) as v
    from public.payments p
    join public.subscriptions sub on sub.id = p.subscription_id
    where p.paid_at >= v_first and p.paid_at < v_after
      and (p_location_id is null or sub.location_id = p_location_id)
    group by 1
  ) pay on pay.n = m.n
  left join (
    select extract(month from x.expense_date)::integer as n, sum(x.amount_fils) as v
    from public.expenses x
    where x.expense_date >= v_first and x.expense_date < v_after
      and (p_location_id is null or x.location_id = p_location_id)
    group by 1
  ) exp on exp.n = m.n
  order by m.n;
end;
$$;

create function public.expenses_by_category(p_from date, p_to date, p_location_id uuid default null)
returns table (category public.expense_category, total_fils bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;

  return query
  select x.category, sum(x.amount_fils)::bigint
  from public.expenses x
  where x.expense_date between p_from and p_to
    and (p_location_id is null or x.location_id = p_location_id)
  group by x.category
  order by 2 desc, 1;
end;
$$;

-- One row per location that is active or has money in the period, plus one row with a null location_id for
-- payments on subscriptions without a location and expenses without one. The rows add up to report_summary.
create function public.report_by_location(p_from date, p_to date)
returns table (location_id uuid, collected_fils bigint, expenses_fils bigint, profit_fils bigint, margin_bps integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;

  return query
  with c as (
    select sub.location_id as lid, sum(pay.amount_fils)::bigint as v
    from public.payments pay
    join public.subscriptions sub on sub.id = pay.subscription_id
    where pay.paid_at between p_from and p_to
    group by sub.location_id
  ), e as (
    select x.location_id as lid, sum(x.amount_fils)::bigint as v
    from public.expenses x
    where x.expense_date between p_from and p_to
    group by x.location_id
  ), ids as (
    select l.id as lid from public.locations l where l.active
    union
    select c.lid from c
    union
    select e.lid from e
  )
  select
    ids.lid,
    coalesce(c.v, 0)::bigint,
    coalesce(e.v, 0)::bigint,
    (coalesce(c.v, 0) - coalesce(e.v, 0))::bigint,
    case
      when coalesce(c.v, 0) = 0 then null
      else round((coalesce(c.v, 0) - coalesce(e.v, 0))::numeric * 10000 / c.v)::integer
    end
  from ids
  left join c on c.lid is not distinct from ids.lid
  left join e on e.lid is not distinct from ids.lid
  order by ids.lid nulls last;
end;
$$;

revoke all on function public.report_summary(date, date, uuid) from public, anon;
revoke all on function public.revenue_by_month(integer, uuid) from public, anon;
revoke all on function public.expenses_by_category(date, date, uuid) from public, anon;
revoke all on function public.report_by_location(date, date) from public, anon;
grant execute on function public.report_summary(date, date, uuid) to authenticated;
grant execute on function public.revenue_by_month(integer, uuid) to authenticated;
grant execute on function public.expenses_by_category(date, date, uuid) to authenticated;
grant execute on function public.report_by_location(date, date) to authenticated;
