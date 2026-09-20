-- Locations (Phase 9): the table's access rules, the guards on sessions / players / expenses, the location on
-- subscriptions (create_subscription, set_subscription_location), the activity trail and the per-location reports.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = fa000000-…-n.
--   users: admin u(1), coach1 u(2), coach2 u(3)
--   locations: L1 u(101) "lt-Rifa", L2 u(102) "lt-Hamad", L3 u(103) inactive "lt-Old", L4 u(104) active "lt-Empty",
--              L5 u(105) "lt-Spare" (switched off during the players section); the admin adds "  lt-New  " (renamed "lt-Renamed")
--   players: u(11), u(12) belong to coach1
--   the report fixtures are dated October 2025 (payments on subscriptions of L1 / L2 / none, expenses of L1 / L2 / none)
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('fa000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
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
-- one player as [{player_id}] for a small int
create function tests.pj(p_id integer) returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('player_id', tests.u(p_id)))
$$;
-- "collected/expenses/profit/margin" of a summary, for one location or (null) for all
create function tests.summary(p_from date, p_to date, p_loc uuid default null) returns text language sql stable as $$
  select collected_fils || '/' || expenses_fils || '/' || profit_fils || '/' || coalesce(margin_bps::text, 'null')
  from public.report_summary(p_from, p_to, p_loc)
$$;
-- the same figures from report_by_location for one location (null = the "no location" row)
create function tests.by_loc(p_from date, p_to date, p_loc uuid) returns text language sql stable as $$
  select collected_fils || '/' || expenses_fils || '/' || profit_fils || '/' || coalesce(margin_bps::text, 'null')
  from public.report_by_location(p_from, p_to) r where r.location_id is not distinct from p_loc
$$;
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
-- The hosted project may hold real rows: everything below is rolled back, but the totals must be exact.
delete from public.payments;
delete from public.expenses;

insert into auth.users (id, email) values
  (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid'), (tests.u(3), 'coach2@tests.invalid');
insert into public.profiles (id, full_name, email, role) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin'),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach'),
  (tests.u(3), 'Coach Two', 'coach2@tests.invalid', 'coach');

insert into public.locations (id, name, active) values
  (tests.u(101), 'lt-Rifa', true), (tests.u(102), 'lt-Hamad', true),
  (tests.u(103), 'lt-Old', false), (tests.u(104), 'lt-Empty', true), (tests.u(105), 'lt-Spare', true);

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  (tests.u(11), 'lt-P1', '930000011', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(12), 'lt-P2', '930000012', '2015-01-01', '39000000', tests.u(2));

update public.settings set tshirt_fee_fils = 5000, transport_fee_fils = 10000, expiring_soon_days = 7;
update public.plans set price_fils = 20000, active = true where code = 'solo';

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- the locations table: who can read and write
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select is((select count(*)::int from public.locations where name like 'lt-%'), 5, 'a coach can read every location (inactive ones too, for history)');
select throws_ok($$insert into public.locations (name) values ('lt-Coach')$$, '42501', null, 'a coach cannot add a location');
select is(tests.affected($$update public.locations set name = 'lt-Hacked' where id = tests.u(101)$$), 0, 'nor rename one');
select tests.act_as_anon();
select throws_ok($$select id from public.locations$$, '42501', null, 'anon cannot read locations');
select tests.act_as(tests.u(1));
select lives_ok($$insert into public.locations (name, address) values ('  lt-New  ', 'Road 1')$$, 'an admin adds a location');
select throws_ok($$insert into public.locations (name) values ('LT-NEW')$$, '23505', null, 'a name is unique ignoring case and surrounding spaces');
select throws_ok($$insert into public.locations (name) values ('   ')$$, '23514', null, 'a blank name is refused');
select throws_ok($$insert into public.locations (name) values (repeat('x', 121))$$, '23514', null, 'a name over 120 characters is refused');
select throws_ok($$delete from public.locations where name = '  lt-New  '$$, '42501', null, 'a location is never deleted (switch it off instead)');
select throws_ok($$update public.locations set created_at = now() where name = '  lt-New  '$$, '42501', null, 'only name, address and active can be changed');
select lives_ok($$update public.locations set name = 'lt-Renamed' where name = '  lt-New  '$$, 'an admin renames one');
select lives_ok($$update public.locations set name = name where name = 'lt-Renamed'$$, 'saving without a change works');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'location.created' and summary ->> 'location_name' = '  lt-New  ' and actor_id = tests.u(1)), 1, 'creating is logged once, by the admin');
select is((select count(*)::int from public.activity_log where action = 'location.updated' and summary ->> 'location_name' = 'lt-Renamed'), 1, 'a real change is logged, a save without change is not');
select is((select summary ->> 'previous_name' from public.activity_log where action = 'location.updated' and summary ->> 'location_name' = 'lt-Renamed'), '  lt-New  ', 'the log keeps the previous name');

-- ---------------------------------------------------------------------------
-- sessions: an active location is required for a new session
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(2))$$, '23514', 'ajyal:location_required', 'a session needs a location');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id, location_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(2), tests.u(103))$$, '23514', 'ajyal:invalid_location', 'an inactive location cannot take a new session');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id, location_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(2), tests.u(999))$$, '23514', 'ajyal:invalid_location', 'nor can an unknown one');
select lives_ok($$insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, location_id)
  values (tests.u(201), public.today_bh(), '16:00', '17:00', tests.u(2), tests.u(101))$$, 'a coach schedules at an active location');
select lives_ok($$update public.training_sessions set location_id = tests.u(102) where id = tests.u(201)$$, 'and can move it to another active one');
select throws_ok($$update public.training_sessions set location_id = tests.u(103) where id = tests.u(201)$$, '23514', 'ajyal:invalid_location', 'but not to an inactive one');
select throws_ok($$update public.training_sessions set location_id = null where id = tests.u(201)$$, '23514', 'ajyal:location_required', 'nor remove it');
select tests.reset();
select is((select summary ->> 'location_name' from public.activity_log where action = 'session.created' and entity_id = tests.u(201)), 'lt-Rifa', 'the feed entry names the location the session was created at (before it was moved)');

-- A session in a location that is later switched off stays editable and keeps its place.
select tests.act_as(tests.u(1));
select lives_ok($$insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, location_id)
  values (tests.u(202), public.today_bh(), '18:00', '19:00', tests.u(2), tests.u(104))$$, 'a session at the (still active) empty location');
select lives_ok($$update public.locations set active = false where id = tests.u(104)$$, 'the location is switched off later');
select lives_ok($$update public.training_sessions set notes = 'bring bibs' where id = tests.u(202)$$, 'the session can still be edited');
select is((select location_id from public.training_sessions where id = tests.u(202)), tests.u(104), 'and keeps its location');
select lives_ok($$update public.locations set active = true where id = tests.u(104)$$, 'switching it back on');

-- The attendance view carries the location's name.
select tests.reset();
insert into public.attendance (session_id, player_id, status) values (tests.u(201), tests.u(11), 'present');
select tests.act_as(tests.u(1));
select is((select location_name from public.player_attendance where session_id = tests.u(201) and player_id = tests.u(11)), 'lt-Hamad', 'player_attendance exposes the location name');
select tests.reset();

-- ---------------------------------------------------------------------------
-- players: an optional location label
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$insert into public.players (id, full_name, cpr, date_of_birth, phone, location_id)
  values (tests.u(13), 'lt-P3', '930000013', '2015-01-01', '39000000', tests.u(101))$$, 'a coach can give a new player an active location');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, location_id)
  values ('lt-P4', '930000014', '2015-01-01', '39000000', tests.u(103))$$, '23514', 'ajyal:invalid_location', 'but not an inactive one');
select lives_ok($$insert into public.players (id, full_name, cpr, date_of_birth, phone)
  values (tests.u(14), 'lt-P5', '930000015', '2015-01-01', '39000000')$$, 'a player without a location is fine');
select lives_ok($$update public.players set location_id = tests.u(102) where id = tests.u(14)$$, 'a location can be set later');
select throws_ok($$update public.players set location_id = tests.u(103) where id = tests.u(14)$$, '23514', 'ajyal:invalid_location', 'but not to an inactive one');
select tests.reset();
update public.players set location_id = tests.u(105) where id = tests.u(13);
update public.locations set active = false where id = tests.u(105); -- switched off later
select tests.act_as(tests.u(2));
select lives_ok($$update public.players set school = 'lt-School' where id = tests.u(13)$$, 'a player in a location that is now off can still be edited');

-- ---------------------------------------------------------------------------
-- expenses: an optional location (none = academy-wide)
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select lives_ok($$insert into public.expenses (id, category, amount_fils, expense_date, location_id)
  values (tests.u(301), 'field_rent', 1000, '2025-06-01', tests.u(101))$$, 'an expense can belong to a location');
select lives_ok($$insert into public.expenses (id, category, amount_fils, expense_date)
  values (tests.u(302), 'other', 1000, '2025-06-01')$$, 'or to none (academy-wide)');
select throws_ok($$insert into public.expenses (category, amount_fils, expense_date, location_id)
  values ('other', 1000, '2025-06-01', tests.u(103))$$, '23514', 'ajyal:invalid_location', 'an inactive location is refused');
select lives_ok($$update public.expenses set location_id = tests.u(102) where id = tests.u(301)$$, 'the location can be changed');
select throws_ok($$update public.expenses set location_id = tests.u(103) where id = tests.u(301)$$, '23514', 'ajyal:invalid_location', 'but not to an inactive one');
select lives_ok($$update public.expenses set location_id = null where id = tests.u(301)$$, 'or cleared');
select tests.reset();
delete from public.expenses where id in (tests.u(301), tests.u(302));

-- ---------------------------------------------------------------------------
-- subscriptions: create_subscription needs a location; set_subscription_location relabels
-- ---------------------------------------------------------------------------
create temp table _s (k text primary key, id uuid);
grant all on _s to public;
select tests.act_as(tests.u(2));
select throws_ok($$select public.create_subscription(public.today_bh() + 200, public.today_bh() + 229, tests.pj(11), null)$$, '22023', 'ajyal:location_required', 'a subscription needs a location');
select throws_ok($$select public.create_subscription(public.today_bh() + 200, public.today_bh() + 229, tests.pj(11), tests.u(103))$$, '22023', 'ajyal:invalid_location', 'an inactive location is refused');
select throws_ok($$select public.create_subscription(public.today_bh() + 200, public.today_bh() + 229, tests.pj(11), tests.u(999))$$, '22023', 'ajyal:invalid_location', 'an unknown one too');
insert into _s select 'A', public.create_subscription(public.today_bh() + 200, public.today_bh() + 229, tests.pj(11), tests.u(101), null, null, null, null, 20000);
select is((select location_id from public.subscriptions where id = (select id from _s where k = 'A')), tests.u(101), 'the subscription is stored with its location');
select is((select location_name from public.subscription_overview where id = (select id from _s where k = 'A')), 'lt-Rifa', 'the overview shows the location name');
select tests.reset();
select is((select summary ->> 'location_name' from public.activity_log where action = 'subscription.created' and entity_id = (select id from _s where k = 'A')), 'lt-Rifa', 'the feed entry names the location');

-- a subscription that pre-dates locations (no location) — created directly as the superuser
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils)
  select tests.u(401), id, '2025-01-01', '2025-01-31', 20000, 20000 from public.plans where code = 'solo';

select tests.act_as(tests.u(2));
select throws_ok($$select public.set_subscription_location(tests.u(401), tests.u(101))$$, '42501', 'ajyal:forbidden', 'a coach cannot change a subscription''s location');
select tests.act_as_anon();
select throws_ok($$select public.set_subscription_location(tests.u(401), tests.u(101))$$, '42501', null, 'nor can anon');
select tests.act_as(tests.u(1));
select throws_ok($$select public.set_subscription_location(tests.u(999), tests.u(101))$$, 'P0002', 'ajyal:subscription_not_found', 'an unknown subscription');
select throws_ok($$select public.set_subscription_location(tests.u(401), null)$$, '22023', 'ajyal:location_required', 'a location is required');
select throws_ok($$select public.set_subscription_location(tests.u(401), tests.u(103))$$, '22023', 'ajyal:invalid_location', 'and an active one');
select lives_ok($$select public.set_subscription_location(tests.u(401), tests.u(101))$$, 'an admin labels an older subscription');
select lives_ok($$select public.set_subscription_location(tests.u(401), tests.u(101))$$, 'setting the same location again is a no-op');
select lives_ok($$select public.set_subscription_location(tests.u(401), tests.u(102))$$, 'and can move it');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'subscription.location_changed' and entity_id = tests.u(401)), 2, 'two real changes are logged (the no-op is not)');
select is((select summary ->> 'to_location_name' from public.activity_log where action = 'subscription.location_changed' and entity_id = tests.u(401) order by created_at desc, id limit 1) is not null, true, 'each entry names the location it moved to');
select is((select count(*)::int from public.activity_log where action = 'subscription.location_changed' and entity_id = tests.u(401) and summary -> 'from_location_name' = 'null'::jsonb), 1, 'the first change had no previous location');
update public.subscriptions set cancelled_at = now() where id = tests.u(401);
select tests.act_as(tests.u(1));
select lives_ok($$select public.set_subscription_location(tests.u(401), tests.u(101))$$, 'a cancelled subscription can be relabelled too (history)');
select tests.reset();
delete from public.payments;
delete from public.subscription_players where subscription_id in (select id from _s);
delete from public.subscriptions where id in (select id from _s) or id = tests.u(401);

-- ---------------------------------------------------------------------------
-- reports per location: October 2025
--   payments  L1: 100 000 (5th) + 50 000 (20th) · L2: 80 000 (10th) · no location: 30 000 (12th)
--             L1: 7 000 on 1 Nov (outside October)
--   expenses  L1: 40 000 (3rd) · L2: 20 000 (4th) + 5 000 equipment (6th) · none: 60 000 salary (1st)
--             L1: 9 000 on 30 Sep (outside)
--   all: collected 260 000, expenses 125 000, profit 135 000, margin 51.92%
-- ---------------------------------------------------------------------------
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils, location_id)
  select tests.u(n), id, '2025-01-01', '2025-12-31', 1000000, 1000000, l
  from public.plans, (values (501, tests.u(101)), (502, tests.u(102)), (503, null::uuid)) as s (n, l)
  where code = 'solo';
insert into public.payments (subscription_id, amount_fils, paid_at) values
  (tests.u(501), 100000, '2025-10-05'), (tests.u(501), 50000, '2025-10-20'), (tests.u(502), 80000, '2025-10-10'),
  (tests.u(503), 30000, '2025-10-12'), (tests.u(501), 7000, '2025-11-01');
insert into public.expenses (category, amount_fils, expense_date, coach_id, location_id) values
  ('field_rent', 40000, '2025-10-03', null, tests.u(101)),
  ('field_rent', 20000, '2025-10-04', null, tests.u(102)),
  ('equipment', 5000, '2025-10-06', null, tests.u(102)),
  ('coach_salary', 60000, '2025-10-01', tests.u(2), null),
  ('field_rent', 9000, '2025-09-30', null, tests.u(101));

select tests.act_as(tests.u(1));
select is(tests.summary('2025-10-01', '2025-10-31'), '260000/125000/135000/5192', 'all locations: the sum of everything');
select is(tests.summary('2025-10-01', '2025-10-31', tests.u(101)), '150000/40000/110000/7333', 'L1: its payments and its expenses only (the 1 Nov and 30 Sep rows are outside)');
select is(tests.summary('2025-10-01', '2025-10-31', tests.u(102)), '80000/25000/55000/6875', 'L2');
select is(tests.summary('2025-10-01', '2025-10-31', tests.u(104)), '0/0/0/null', 'a location with nothing: zeros and no margin');
select is(tests.summary('2025-10-01', '2025-10-31', tests.u(999)), '0/0/0/null', 'an unknown location behaves the same');
select is(tests.by_loc('2025-10-01', '2025-10-31', tests.u(101)), '150000/40000/110000/7333', 'report_by_location: L1');
select is(tests.by_loc('2025-10-01', '2025-10-31', tests.u(102)), '80000/25000/55000/6875', 'L2');
select is(tests.by_loc('2025-10-01', '2025-10-31', null), '30000/60000/-30000/-10000', 'the no-location row: the older payment and the academy-wide salary');
select is(tests.by_loc('2025-10-01', '2025-10-31', tests.u(104)), '0/0/0/null', 'an active location with no activity is listed with zeros');
select is((select count(*)::int from public.report_by_location('2025-10-01', '2025-10-31') where location_id = tests.u(103)), 0, 'an inactive location with no activity is not listed');
select is((select sum(collected_fils) || '/' || sum(expenses_fils) || '/' || sum(profit_fils) from public.report_by_location('2025-10-01', '2025-10-31')), '260000/125000/135000', 'the rows add up to the all-locations figures');
select is((select count(*)::int from public.report_by_location('2025-10-01', '2025-10-31') where location_id is null), 1, 'exactly one no-location row');
select is((select count(*)::int from public.report_by_location('2023-01-01', '2023-01-31') where location_id is null), 0, 'no no-location row when it has nothing');
select is((select collected_fils || '/' || expenses_fils from public.revenue_by_month(2025, tests.u(101)) where month_start = '2025-10-01'), '150000/40000', 'revenue_by_month for L1: October');
select is((select collected_fils || '/' || expenses_fils from public.revenue_by_month(2025, tests.u(101)) where month_start = '2025-09-01'), '0/9000', 'September (expense only)');
select is((select collected_fils || '/' || expenses_fils from public.revenue_by_month(2025, tests.u(101)) where month_start = '2025-11-01'), '7000/0', 'November (payment only)');
select is((select count(*)::int from public.revenue_by_month(2025, tests.u(101))), 12, 'still 12 rows');
select is((select sum(collected_fils) || '/' || sum(expenses_fils) from public.revenue_by_month(2025)), '267000/134000', 'without a location the year is everything');
select is((select string_agg(category || ':' || total_fils, ',') from public.expenses_by_category('2025-10-01', '2025-10-31', tests.u(102))), 'field_rent:20000,equipment:5000', 'expenses_by_category for L2, biggest first');
select is((select string_agg(category || ':' || total_fils, ',') from public.expenses_by_category('2025-10-01', '2025-10-31')), 'coach_salary:60000,field_rent:60000,equipment:5000', 'and for everything');
select tests.act_as(tests.u(1));
select throws_ok($$select * from public.report_summary('2025-10-31', '2025-10-01', null)$$, '22023', 'ajyal:invalid_period', 'a period must not run backwards');
select throws_ok($$select * from public.report_by_location('2025-10-31', '2025-10-01')$$, '22023', 'ajyal:invalid_period', 'also for the location split');

-- Only admins may look at money, per location or not.
select tests.act_as(tests.u(2));
select throws_ok($$select * from public.report_by_location('2025-10-01', '2025-10-31')$$, '42501', 'ajyal:forbidden', 'a coach cannot see the split by location');
select throws_ok($$select * from public.report_summary('2025-10-01', '2025-10-31', tests.u(101))$$, '42501', 'ajyal:forbidden', 'nor one location''s summary');
select tests.act_as_anon();
select throws_ok($$select * from public.report_by_location('2025-10-01', '2025-10-31')$$, '42501', null, 'anon cannot call it');
select tests.reset();

-- ---------------------------------------------------------------------------
-- nothing was opened to anon
-- ---------------------------------------------------------------------------
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('anon', c.oid, 'select,insert,update,delete')$$, 'anon still has no privileges on any public table');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')$$, 'and can execute no public function');

select * from finish();
rollback;
