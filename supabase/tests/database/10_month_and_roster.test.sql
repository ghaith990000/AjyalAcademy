-- Phase 13: a payment is counted in its subscription's month, not the day it was paid (D-106); a session's
-- roster is limited to the coach's active players at the session's own location (D-107).
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = fc000000-…-n.
--   users: admin u(1), coach1 u(2)
--   locations: L1 u(101), L2 u(102)
--   players (all coach1): u(11) at L1, u(12) at L2, u(13) with no location
--   sessions (all today): u(201) at L1, u(202) at L2, u(203) with no location (legacy)
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('fc000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function tests.reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
-- [{player_id, status}] for players given as small ints, all "present"
create function tests.recs(p_ids integer[]) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('player_id', tests.u(i), 'status', 'present')) from unnest(p_ids) as i
$$;
-- "collected/expenses/profit/margin" of a summary as text
create function tests.summary(p_from date, p_to date) returns text language sql stable as $$
  select collected_fils || '/' || expenses_fils || '/' || profit_fils || '/' || coalesce(margin_bps::text, 'null')
  from public.report_summary(p_from, p_to)
$$;
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
-- The hosted project may hold real rows: everything below is rolled back, but the totals must be exact.
delete from public.payments;
delete from public.expenses;

insert into auth.users (id, email) values (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid');
insert into public.profiles (id, full_name, email, role, active) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin', true),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach', true);

insert into public.locations (id, name) values (tests.u(101), 'mr-L1'), (tests.u(102), 'mr-L2');

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id, location_id) values
  (tests.u(11), 'mr-P1', '940000011', '2015-01-01', '39000000', tests.u(2), tests.u(101)),
  (tests.u(12), 'mr-P2', '940000012', '2015-01-01', '39000000', tests.u(2), tests.u(102)),
  (tests.u(13), 'mr-P3', '940000013', '2015-01-01', '39000000', tests.u(2), null);

insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, location_id) values
  (tests.u(201), public.today_bh(), '16:00', '17:00', tests.u(2), tests.u(101)),
  (tests.u(202), public.today_bh(), '16:00', '17:00', tests.u(2), tests.u(102));
-- u(203) pre-dates locations (legacy, D-085): the guard requires one on insert, so it is switched off for this
-- one statement only, exactly as the Phase 9 migration did to backfill old sessions.
alter table public.training_sessions disable trigger sessions_guard;
insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, location_id) values
  (tests.u(203), public.today_bh(), '16:00', '17:00', tests.u(2), null);
alter table public.training_sessions enable trigger sessions_guard;

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- D-106: a payment counts in its subscription's month, not the day it was paid
-- ---------------------------------------------------------------------------
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils)
  select tests.u(301), id, '2025-10-01', '2025-10-31', 20000, 20000 from public.plans where code = 'solo';
insert into public.payments (subscription_id, amount_fils, paid_at) values (tests.u(301), 20000, '2025-12-25');

select tests.act_as(tests.u(1));
select is(tests.summary('2025-10-01', '2025-10-31'), '20000/0/20000/10000', 'October (the subscription''s month) collects the payment, though it was paid in December');
select is(tests.summary('2025-12-01', '2025-12-31'), '0/0/0/null', 'December (the day it was actually paid) collects nothing');
select is((select collected_fils from public.revenue_by_month(2025) where month_start = '2025-10-01'), 20000::bigint, 'revenue_by_month agrees: October, not December');
select is((select collected_fils from public.report_by_location('2025-10-01', '2025-10-31') where location_id is null), 20000::bigint, 'report_by_location agrees too (this subscription has no location)');
select tests.reset();

-- ---------------------------------------------------------------------------
-- D-107: a session's roster = the coach's active players at the session's own location
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$select public.save_attendance(tests.u(201), tests.recs(array[11, 13]))$$,
  'at L1: the L1 player and the no-location player are both on the roster');
select throws_ok($$select public.save_attendance(tests.u(201), tests.recs(array[12]))$$, '22023', 'ajyal:not_on_roster',
  'at L1: the L2 player is not — a coach cannot mark a player who trains elsewhere');

select lives_ok($$select public.save_attendance(tests.u(202), tests.recs(array[12, 13]))$$,
  'at L2: the L2 player and the no-location player are both on the roster');
select throws_ok($$select public.save_attendance(tests.u(202), tests.recs(array[11]))$$, '22023', 'ajyal:not_on_roster',
  'at L2: the L1 player is not');

select lives_ok($$select public.save_attendance(tests.u(203), tests.recs(array[11, 12, 13]))$$,
  'a session with no location (legacy) filters nobody out — every one of the coach''s players is on it');
select tests.reset();

select is((select count(*)::int from public.activity_log where action = 'attendance.saved'), 3, 'one log entry per successful save');

select * from finish();
rollback;
