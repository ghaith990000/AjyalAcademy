-- Ajyal Academy — Phase 13: money follows the subscription's month; a session's roster follows its location.
-- Contract: docs/05-business-rules.md, docs/08-decisions.md D-106, D-107.
--
--   * "Collected" in every report is a payment counted on its SUBSCRIPTION's start_date, not on the day it was
--     paid (payments.paid_at stays as the real receipt date, shown on the subscription). A payment made late
--     still belongs to the month the player subscribed for.
--   * A session's roster = the coach's active players at the session's location. A player with no location, or a
--     session with none (legacy), is not filtered out.

create or replace function public.report_summary(p_from date, p_to date, p_location_id uuid default null)
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
    where sub.start_date between p_from and p_to
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

create or replace function public.revenue_by_month(p_year integer, p_location_id uuid default null)
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
    select extract(month from sub.start_date)::integer as n, sum(p.amount_fils) as v
    from public.payments p
    join public.subscriptions sub on sub.id = p.subscription_id
    where sub.start_date >= v_first and sub.start_date < v_after
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

create or replace function public.expenses_by_category(p_from date, p_to date, p_location_id uuid default null)
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
create or replace function public.report_by_location(p_from date, p_to date)
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
    where sub.start_date between p_from and p_to
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

create or replace function public.save_attendance(p_session_id uuid, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.training_sessions;
  v_total integer;
  v_distinct integer;
  v_missing integer;
  v_present integer;
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if not public.can_view_session(p_session_id) then
    raise exception 'ajyal:session_not_found' using errcode = 'P0002';
  end if;

  -- Serialises with cancelling / editing the same session.
  select * into v_session from public.training_sessions where id = p_session_id for update;
  if not found then
    raise exception 'ajyal:session_not_found' using errcode = 'P0002';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'ajyal:session_cancelled' using errcode = '55000';
  end if;
  if v_session.session_date > public.today_bh() then
    raise exception 'ajyal:session_in_future' using errcode = '55000';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end if;

  begin
    select
      count(*)::integer,
      count(distinct r.player_id)::integer,
      (count(*) filter (where r.player_id is null or r.status is null))::integer,
      (count(*) filter (where r.status = 'present'))::integer
    into v_total, v_distinct, v_missing, v_present
    from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status);
  exception when others then
    -- not objects, a malformed uuid or an unknown status
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end;
  if v_missing > 0 or v_total <> v_distinct then
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status)
    where not exists (
      select 1 from public.players p
      where p.id = r.player_id and p.coach_id = v_session.coach_id and p.deleted_at is null
        and (v_session.location_id is null or p.location_id is null or p.location_id = v_session.location_id)
    )
  ) then
    raise exception 'ajyal:not_on_roster' using errcode = '22023';
  end if;

  insert into public.attendance (session_id, player_id, status, marked_by, marked_at)
  select p_session_id, r.player_id, r.status, auth.uid(), now()
  from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status)
  on conflict (session_id, player_id) do update
    set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at
    where public.attendance.status is distinct from excluded.status;

  perform public.log_activity(
    'attendance.saved', 'attendance', p_session_id,
    jsonb_build_object(
      'session_date', v_session.session_date,
      'start_time', v_session.start_time,
      'coach_name', (select full_name from public.profiles where id = v_session.coach_id),
      'present_count', v_present,
      'total_count', v_total
    )
  );
end;
$$;

-- create or replace keeps the grants; restated so this file stands on its own.
revoke all on function public.save_attendance(uuid, jsonb) from public, anon;
grant execute on function public.save_attendance(uuid, jsonb) to authenticated;
