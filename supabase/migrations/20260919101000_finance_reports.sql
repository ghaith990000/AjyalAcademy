-- Ajyal Academy — Phase 6: expenses guard, salary generation and the report functions.
-- Contract: docs/04-data-model.md ("As built (Phase 6)"), rules: docs/05-business-rules.md#expenses-and-reports.
--
--   * expenses stay plain table access (admin only, RLS from the core migration); trg_expenses_guard adds what RLS
--     cannot express, and edits/deletes are logged (money that changes or disappears leaves a trace).
--   * generate_monthly_salaries(month)       — idempotent; one coach_salary expense per active coach with a salary
--   * report_summary(from, to)               — collected / expenses / profit / margin for a date range (inclusive)
--   * revenue_by_month(year)                 — 12 rows, zero-filled
--   * expenses_by_category(from, to)         — only categories that have expenses in the range
--   All four are SECURITY DEFINER with their own admin check: payments are visible to coaches through RLS, so a
--   plain SECURITY INVOKER sum would leak the academy's takings to them.

-- ---------------------------------------------------------------------------
-- expenses guard
--   * created_by is always the caller
--   * an expense cannot be dated after today's academy date (today_bh(), D-047)
--   * a salary's coach must be a coach (the table constraints already tie coach_id to coach_salary)
-- ---------------------------------------------------------------------------
create function public.trg_expenses_guard()
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

  return new;
end;
$$;

create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.trg_expenses_guard();

-- ---------------------------------------------------------------------------
-- expenses: updated / deleted are logged with a snapshot (created is logged by the earlier trigger)
-- ---------------------------------------------------------------------------
create function public.trg_expenses_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.expenses := case when tg_op = 'DELETE' then old else new end;
begin
  perform public.log_activity(
    case when tg_op = 'DELETE' then 'expense.deleted' else 'expense.updated' end,
    'expense', v_row.id,
    jsonb_build_object(
      'category', v_row.category,
      'amount_fils', v_row.amount_fils,
      'expense_date', v_row.expense_date
    )
  );
  return null;
end;
$$;

create trigger expenses_activity_change after update or delete on public.expenses
  for each row execute function public.trg_expenses_activity_change();

-- ---------------------------------------------------------------------------
-- generate_monthly_salaries
--   One `coach_salary` expense per ACTIVE coach whose monthly_salary_fils > 0, dated the 1st of the month, for a
--   coach who has no salary expense in that month yet — so running it twice creates nothing new. Any date in the
--   month picks the month; a month after the current one is refused. The amount is copied from the profile at the
--   time of the run (later salary changes never rewrite history). Logs ONE `expense.salaries_generated` entry
--   (not one per row) and only when something was created.
-- ---------------------------------------------------------------------------
create function public.generate_monthly_salaries(p_month date)
returns table (created_count integer, skipped_count integer, created_fils bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_next date;
  v_eligible integer;
  v_created integer;
  v_fils bigint;
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;
  -- first of the month by plain date arithmetic (no time-zone round trip)
  v_month := p_month - (extract(day from p_month)::integer - 1);
  if v_month > public.today_bh() - (extract(day from public.today_bh())::integer - 1) then
    raise exception 'ajyal:invalid_period' using errcode = '22023';
  end if;
  v_next := (v_month + interval '1 month')::date;

  -- Two admins pressing the button together must not both see "no salary yet".
  perform pg_advisory_xact_lock(hashtextextended('generate_monthly_salaries:' || v_month::text, 0));

  select count(*)::integer into v_eligible
  from public.profiles where role = 'coach' and active and monthly_salary_fils > 0;

  perform set_config('ajyal.bulk', 'on', true);
  with inserted as (
    insert into public.expenses (category, amount_fils, expense_date, coach_id)
    select 'coach_salary', p.monthly_salary_fils, v_month, p.id
    from public.profiles p
    where p.role = 'coach' and p.active and p.monthly_salary_fils > 0
      and not exists (
        select 1 from public.expenses x
        where x.category = 'coach_salary' and x.coach_id = p.id
          and x.expense_date >= v_month and x.expense_date < v_next
      )
    returning amount_fils
  )
  select count(*)::integer, coalesce(sum(amount_fils), 0)::bigint into v_created, v_fils from inserted;
  perform set_config('ajyal.bulk', 'off', true);

  if v_created > 0 then
    perform public.log_activity(
      'expense.salaries_generated', 'expense', null,
      jsonb_build_object('month', v_month, 'created_count', v_created, 'created_fils', v_fils)
    );
  end if;

  return query select v_created, v_eligible - v_created, v_fils;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_summary — both ends inclusive, on the payment's paid_at / the expense's expense_date.
--   margin_bps = profit / collected in basis points, rounded half away from zero; null when nothing was
--   collected (the UI shows "—"). Payments of cancelled subscriptions and of removed players still count:
--   the money was received, and financial history survives.
-- ---------------------------------------------------------------------------
create function public.report_summary(p_from date, p_to date)
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
    from public.payments pay where pay.paid_at between p_from and p_to
  ), e as (
    select coalesce(sum(exp.amount_fils), 0)::bigint as v
    from public.expenses exp where exp.expense_date between p_from and p_to
  )
  select
    c.v,
    e.v,
    c.v - e.v,
    case when c.v = 0 then null else round((c.v - e.v)::numeric * 10000 / c.v)::integer end
  from c, e;
end;
$$;

-- ---------------------------------------------------------------------------
-- revenue_by_month — always 12 rows (January … December), zero where nothing happened
-- ---------------------------------------------------------------------------
create function public.revenue_by_month(p_year integer)
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
    from public.payments p where p.paid_at >= v_first and p.paid_at < v_after group by 1
  ) pay on pay.n = m.n
  left join (
    select extract(month from x.expense_date)::integer as n, sum(x.amount_fils) as v
    from public.expenses x where x.expense_date >= v_first and x.expense_date < v_after group by 1
  ) exp on exp.n = m.n
  order by m.n;
end;
$$;

-- ---------------------------------------------------------------------------
-- expenses_by_category — only categories that have expenses in the range, biggest first
-- ---------------------------------------------------------------------------
create function public.expenses_by_category(p_from date, p_to date)
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
  group by x.category
  order by 2 desc, 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- grants: signed-in users only (each function then insists on an active admin)
-- ---------------------------------------------------------------------------
revoke all on function public.generate_monthly_salaries(date) from public, anon;
revoke all on function public.report_summary(date, date) from public, anon;
revoke all on function public.revenue_by_month(integer) from public, anon;
revoke all on function public.expenses_by_category(date, date) from public, anon;
grant execute on function public.generate_monthly_salaries(date) to authenticated;
grant execute on function public.report_summary(date, date) to authenticated;
grant execute on function public.revenue_by_month(integer) to authenticated;
grant execute on function public.expenses_by_category(date, date) to authenticated;
