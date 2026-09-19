-- Finance & reports: the expenses guard + activity trail, generate_monthly_salaries (idempotency), report_summary,
-- revenue_by_month and expenses_by_category (worked example, month/year edges) and admin-only access.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = f9000000-…-n.
--   users: admin u(1), coach1 u(2) salary 150 BD, coach2 u(3) salary 100 BD, inactive coach u(4) salary 90 BD,
--          coach4 u(5) salary 0, inactive admin u(6)
--   all money fixtures are dated in 2024/2025 (safely in the past); the worked example is October 2025.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('f9000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;
create function tests.reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
-- "collected/expenses/profit/margin" of a summary as text (margin "null" when there is nothing to divide by)
create function tests.summary(p_from date, p_to date) returns text language sql stable as $$
  select collected_fils || '/' || expenses_fils || '/' || profit_fils || '/' || coalesce(margin_bps::text, 'null')
  from public.report_summary(p_from, p_to)
$$;
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
-- The hosted project may hold real rows: everything below is rolled back, but the totals must be exact.
delete from public.payments;
delete from public.expenses;
update public.profiles set monthly_salary_fils = 0;

insert into auth.users (id, email) values
  (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid'), (tests.u(3), 'coach2@tests.invalid'),
  (tests.u(4), 'coach3@tests.invalid'), (tests.u(5), 'coach4@tests.invalid'), (tests.u(6), 'admin2@tests.invalid');
insert into public.profiles (id, full_name, email, role, active, monthly_salary_fils) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin', true, 0),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach', true, 150000),
  (tests.u(3), 'Coach Two', 'coach2@tests.invalid', 'coach', true, 100000),
  (tests.u(4), 'Coach Gone', 'coach3@tests.invalid', 'coach', false, 90000),
  (tests.u(5), 'Coach Unpaid', 'coach4@tests.invalid', 'coach', true, 0),
  (tests.u(6), 'Admin Gone', 'admin2@tests.invalid', 'admin', false, 0);

-- S1 is cancelled (its payments are still money received); S2 is active.
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils, cancelled_at)
  select tests.u(n), id, '2025-01-01', '2025-12-31', 1000000, 1000000, c
  from public.plans, (values (201, now()), (202, null::timestamptz)) as s (n, c)
  where code = 'solo';

insert into public.payments (subscription_id, amount_fils, paid_at) values
  (tests.u(202), 20000,  '2025-01-31'),  -- Jan: collected 20.000 vs expenses 20.001 → profit -1 fil
  (tests.u(202), 20000,  '2025-02-28'),  -- Feb: collected 20.000 vs expenses 19.999 → profit +1 fil
  (tests.u(202), 10000,  '2025-07-15'),
  (tests.u(202), 100000, '2025-09-30'),  -- last day of September
  (tests.u(201), 200000, '2025-10-01'),  -- first day of October (S1 is cancelled: still counts)
  (tests.u(202), 240000, '2025-10-15'),
  (tests.u(201), 100000, '2025-10-31'),  -- last day of October
  (tests.u(202), 70000,  '2025-11-01'),  -- first day of November
  (tests.u(202), 60000,  '2025-12-31'),  -- last day of the year
  (tests.u(202), 30000,  '2026-01-01'),  -- first day of the next year
  (tests.u(202), 15000,  '2024-12-31'),  -- last day of the previous year
  (tests.u(202), 10000,  '2024-02-29');  -- a leap day

insert into public.expenses (category, amount_fils, expense_date, coach_id) values
  ('other',          20001,  '2025-01-15', null),
  ('other',          19999,  '2025-02-10', null),
  ('equipment',      25000,  '2025-07-04', null),
  ('other',          20000,  '2025-08-20', null),  -- August: expenses only, nothing collected
  ('other',          25000,  '2025-09-30', null),  -- last day of September
  ('coach_salary',   150000, '2025-10-01', tests.u(2)),
  ('field_rent',     50000,  '2025-10-15', null),
  ('transportation', 10000,  '2025-10-31', null),
  ('equipment',      40000,  '2025-11-01', null),  -- first day of November
  ('other',          5000,   '2026-01-01', null),  -- first day of the next year
  ('other',          4000,   '2024-02-29', null),  -- a leap day
  ('coach_salary',   100000, '2025-04-15', tests.u(3));  -- coach 2 was paid by hand, mid-April

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- report_summary: the worked example and the edges
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select is(tests.summary('2025-10-01', '2025-10-31'), '540000/210000/330000/6111',
  'October: collected 540, expenses 210 → profit 330, margin 61.11%');
select is(tests.summary('2025-09-01', '2025-09-30'), '100000/25000/75000/7500',
  'September includes the 30th (both payment and expense) and nothing of October');
select is(tests.summary('2025-11-01', '2025-11-30'), '70000/40000/30000/4286',
  'November includes the 1st and nothing of October');
select is(tests.summary('2023-12-01', '2023-12-31'), '0/0/0/null', 'a month with nothing: zeros and no margin');
select is(tests.summary('2025-08-01', '2025-08-31'), '0/20000/-20000/null',
  'nothing collected but money spent: negative profit, margin left empty (nothing to divide by)');
select is(tests.summary('2025-07-01', '2025-07-31'), '10000/25000/-15000/-15000',
  'negative profit gives a negative margin (−150.00%)');
select is(tests.summary('2025-01-01', '2025-01-31'), '20000/20001/-1/-1', 'a margin of exactly −0.5 bp rounds away from zero');
select is(tests.summary('2025-02-01', '2025-02-28'), '20000/19999/1/1', 'and +0.5 bp rounds up');
select is(tests.summary('2025-10-15', '2025-10-15'), '240000/50000/190000/7917', 'a single day works (both ends inclusive)');
select is(tests.summary('2025-01-01', '2025-12-31'), '820000/460000/360000/4390',
  'the year 2025: nothing from 2024-12-31 or 2026-01-01');
select is(tests.summary('2024-01-01', '2024-12-31'), '25000/4000/21000/8400', 'the year 2024 (leap day counted, 2025 not)');
select is(tests.summary('2026-01-01', '2026-01-01'), '30000/5000/25000/8333', 'the first day of 2026');

select throws_ok($$select * from public.report_summary('2025-10-31', '2025-10-01')$$, '22023', 'ajyal:invalid_period', 'from after to is refused');
select throws_ok($$select * from public.report_summary(null, '2025-10-01')$$, '22023', 'ajyal:invalid_period', 'a missing date is refused');

-- ---------------------------------------------------------------------------
-- revenue_by_month
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.revenue_by_month(2025)), 12, 'a year always has 12 rows');
select is((select min(month_start)::text || '..' || max(month_start)::text from public.revenue_by_month(2025)), '2025-01-01..2025-12-01',
  'January to December, first of each month');
select is((select collected_fils || '/' || expenses_fils || '/' || profit_fils from public.revenue_by_month(2025) where month_start = '2025-10-01'),
  '540000/210000/330000', 'October row matches the worked example');
select is((select collected_fils || '/' || expenses_fils || '/' || profit_fils from public.revenue_by_month(2025) where month_start = '2025-12-01'),
  '60000/0/60000', 'December 31st belongs to December');
select is((select collected_fils || '/' || expenses_fils || '/' || profit_fils from public.revenue_by_month(2025) where month_start = '2025-03-01'),
  '0/0/0', 'an empty month is a zero row');
select is((select collected_fils || '/' || expenses_fils from public.revenue_by_month(2024) where month_start = '2024-02-01'),
  '10000/4000', 'the leap day is in February 2024');
select is((select collected_fils || '/' || expenses_fils from public.revenue_by_month(2024) where month_start = '2024-12-01'),
  '15000/0', 'December 31st 2024 is in 2024 …');
select is((select collected_fils + expenses_fils from public.revenue_by_month(2025) where month_start = '2025-01-01'), 40001::bigint,
  '… and not in January 2025');
select is((select sum(collected_fils)::bigint from public.revenue_by_month(2025)), (select collected_fils from public.report_summary('2025-01-01', '2025-12-31')),
  'the year view equals the sum of its 12 months (collected)');
select is((select sum(expenses_fils)::bigint from public.revenue_by_month(2025)), (select expenses_fils from public.report_summary('2025-01-01', '2025-12-31')),
  'the year view equals the sum of its 12 months (expenses)');
select is((select sum(profit_fils)::bigint from public.revenue_by_month(2025)), (select profit_fils from public.report_summary('2025-01-01', '2025-12-31')),
  'the year view equals the sum of its 12 months (profit)');
select throws_ok($$select * from public.revenue_by_month(1999)$$, '22023', 'ajyal:invalid_period', 'a year before 2000 is refused');
select throws_ok($$select * from public.revenue_by_month(2101)$$, '22023', 'ajyal:invalid_period', 'and one after 2100');
select throws_ok($$select * from public.revenue_by_month(null)$$, '22023', 'ajyal:invalid_period', 'and a missing one');

-- ---------------------------------------------------------------------------
-- expenses_by_category
-- ---------------------------------------------------------------------------
select is((select string_agg(category::text || ':' || total_fils, ',' order by total_fils desc) from public.expenses_by_category('2025-10-01', '2025-10-31')),
  'coach_salary:150000,field_rent:50000,transportation:10000', 'October by category, biggest first');
select is((select count(*)::int from public.expenses_by_category('2025-10-01', '2025-10-31')), 3, 'categories without expenses are left out');
select is((select string_agg(category::text || ':' || total_fils, ',' order by category) from public.expenses_by_category('2025-01-01', '2025-12-31')),
  'coach_salary:250000,field_rent:50000,transportation:10000,equipment:65000,other:85000', 'the year adds a category up across months (enum order)');
select is((select sum(total_fils)::bigint from public.expenses_by_category('2025-01-01', '2025-12-31')), (select expenses_fils from public.report_summary('2025-01-01', '2025-12-31')),
  'the category totals add up to the summary');
select is((select count(*)::int from public.expenses_by_category('2023-01-01', '2023-12-31')), 0, 'no expenses, no rows');
select throws_ok($$select * from public.expenses_by_category('2025-10-31', '2025-10-01')$$, '22023', 'ajyal:invalid_period', 'from after to is refused');

-- ---------------------------------------------------------------------------
-- admins only
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2)); -- a coach (who can read some payments through RLS, but never the academy's totals)
select throws_ok($$select * from public.report_summary('2025-10-01', '2025-10-31')$$, '42501', 'ajyal:forbidden', 'a coach cannot read the summary');
select throws_ok($$select * from public.revenue_by_month(2025)$$, '42501', 'ajyal:forbidden', 'nor the monthly figures');
select throws_ok($$select * from public.expenses_by_category('2025-10-01', '2025-10-31')$$, '42501', 'ajyal:forbidden', 'nor the categories');
select throws_ok($$select * from public.generate_monthly_salaries('2025-03-01')$$, '42501', 'ajyal:forbidden', 'nor generate salaries');
select is((select count(*)::int from public.expenses), 0, 'a coach reads no expenses');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date) values ('other', 1000, '2025-10-01')$$, '42501', null,
  'a coach cannot add an expense');
select is(tests.affected($$update public.expenses set amount_fils = 1 where category = 'other'$$), 0, 'a coach cannot edit expenses');
select is(tests.affected($$delete from public.expenses$$), 0, 'a coach cannot delete expenses');

select tests.act_as(tests.u(6)); -- an inactive admin
select throws_ok($$select * from public.report_summary('2025-10-01', '2025-10-31')$$, '42501', 'ajyal:forbidden', 'an inactive admin is refused too');
select throws_ok($$select * from public.generate_monthly_salaries('2025-03-01')$$, '42501', 'ajyal:forbidden', 'also for salaries');

select tests.act_as_anon();
select throws_ok($$select * from public.report_summary('2025-10-01', '2025-10-31')$$, '42501', null, 'signed-out callers cannot call the report functions');
select throws_ok($$select * from public.generate_monthly_salaries('2025-03-01')$$, '42501', null, 'or the salary generator');
select throws_ok($$select count(*) from public.expenses$$, '42501', null, 'or read expenses');

-- ---------------------------------------------------------------------------
-- generate_monthly_salaries
-- ---------------------------------------------------------------------------
select tests.reset();
select tests.act_as(tests.u(1));
select is((select created_count || '/' || skipped_count || '/' || created_fils from public.generate_monthly_salaries('2025-03-17')), '2/0/250000',
  'March: active coaches with a salary get one (the inactive coach and the unpaid coach do not); any date in the month works');
select is((select string_agg(coach_id::text || ':' || amount_fils || ':' || expense_date::text, ',' order by coach_id) from public.expenses
  where category = 'coach_salary' and expense_date between '2025-03-01' and '2025-03-31'),
  tests.u(2)::text || ':150000:2025-03-01,' || tests.u(3)::text || ':100000:2025-03-01', 'dated the 1st, with each coach''s salary');
select is((select created_count || '/' || skipped_count || '/' || created_fils from public.generate_monthly_salaries('2025-03-01')), '0/2/0',
  'running it again creates nothing and skips both');
select is((select count(*)::int from public.expenses where category = 'coach_salary' and expense_date between '2025-03-01' and '2025-03-31'), 2,
  'still one salary per coach');

select is((select created_count || '/' || skipped_count from public.generate_monthly_salaries('2025-04-03')), '1/1',
  'a coach already paid this month (on any day) is skipped');
select is((select count(*)::int from public.expenses where category = 'coach_salary' and coach_id = tests.u(3) and expense_date between '2025-04-01' and '2025-04-30'), 1,
  'and gets no second salary');
select is((select count(*)::int from public.expenses where category = 'coach_salary' and coach_id = tests.u(2) and expense_date = '2025-04-01'), 1,
  'the other coach does');

select is((select count(*)::int from public.activity_log where action = 'expense.salaries_generated'), 2,
  'one log entry per run that created something (March, April) — none for the run that created nothing');
select is((select summary->>'created_count' || '/' || (summary->>'created_fils') || '/' || (summary->>'month') from public.activity_log
  where action = 'expense.salaries_generated' order by created_at, summary->>'month' limit 1), '2/250000/2025-03-01',
  'the entry carries the count, the total and the month');
select is((select count(*)::int from public.activity_log where action = 'expense.created'), 0, 'the generated rows are not logged one by one');

select lives_ok($$select * from public.generate_monthly_salaries(public.today_bh())$$, 'the current month can be generated');
select throws_ok($$select * from public.generate_monthly_salaries(public.today_bh() + 40)$$, '22023', 'ajyal:invalid_period', 'a later month cannot');
select throws_ok($$select * from public.generate_monthly_salaries(null)$$, '22023', 'ajyal:invalid_period', 'nor a missing month');

-- ---------------------------------------------------------------------------
-- expenses guard + activity trail
-- ---------------------------------------------------------------------------
select lives_ok($$insert into public.expenses (id, category, amount_fils, expense_date, description, created_by)
  values (tests.u(301), 'field_rent', 45000, public.today_bh(), 'Pitch', tests.u(2))$$, 'an admin adds an expense dated today');
select is((select created_by from public.expenses where id = tests.u(301)), tests.u(1), 'created_by is the caller, whatever was sent');
select is((select count(*)::int from public.activity_log where action = 'expense.created' and entity_id = tests.u(301)), 1,
  'a hand-made expense is logged (so the bulk switch was reset after generating)');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date) values ('other', 1000, public.today_bh() + 1)$$, '23514', 'ajyal:future_date',
  'an expense cannot be dated in the future');
select throws_ok($$update public.expenses set expense_date = public.today_bh() + 1 where id = tests.u(301)$$, '23514', 'ajyal:future_date',
  'nor moved there');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date) values ('other', 0, public.today_bh())$$, '23514', null, 'the amount must be above zero');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date) values ('coach_salary', 1000, public.today_bh())$$, '23514', null,
  'a salary needs a coach');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date, coach_id) values ('other', 1000, public.today_bh(), tests.u(2))$$, '23514', null,
  'only a salary has a coach');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date, coach_id) values ('coach_salary', 1000, public.today_bh(), tests.u(1))$$, '23514', 'ajyal:invalid_coach',
  'the salary''s coach must be a coach, not an admin');
select lives_ok($$insert into public.expenses (category, amount_fils, expense_date, coach_id) values ('coach_salary', 1000, '2025-05-01', tests.u(4))$$,
  'a coach who has since left can still be paid for a past month');

select lives_ok($$update public.expenses set amount_fils = 47000, description = 'Pitch (fixed)' where id = tests.u(301)$$, 'an admin edits an expense');
select is((select count(*)::int from public.activity_log where action = 'expense.updated' and entity_id = tests.u(301) and summary->>'amount_fils' = '47000'), 1,
  'the edit is logged with the new amount');
select lives_ok($$update public.expenses set created_by = tests.u(3) where id = tests.u(301)$$, 'created_by is not editable …');
select is((select created_by from public.expenses where id = tests.u(301)), tests.u(1), '… it stays the original author');
select is(tests.affected($$delete from public.expenses where id = tests.u(301)$$), 1, 'an admin deletes an expense');
select is((select summary->>'category' || '/' || (summary->>'amount_fils') || '/' || (summary->>'expense_date') from public.activity_log
  where action = 'expense.deleted' and entity_id = tests.u(301)), 'field_rent/47000/' || public.today_bh()::text, 'the deletion is logged with a snapshot');
select is((select count(*)::int from public.activity_log where action = 'expense.deleted' and summary->>'actor_name' = 'Admin A'), 1, 'and who did it');

select * from finish();
rollback;
