-- Access control: RLS, grants, guard triggers, activity log. Contract: docs/04-data-model.md#rls-matrix
--
-- Run:  npx supabase test db        (local stack)
-- Everything happens inside one transaction that is rolled back, so it is safe against any database.
-- Fixture ids differ from seed.sql so both can coexist; assertions filter to fixture rows.
--   admin  f0000000-0000-0000-0000-0000000000a1
--   coach1 f0000000-0000-0000-0000-0000000000c1
--   coach2 f0000000-0000-0000-0000-0000000000c2
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Helpers: act as a signed-in user / anonymous / back to the superuser, like a PostgREST request would.
create schema tests;
grant usage on schema tests to public;

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

create function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to public;

-- Fixtures (as the superuser, like the seed / Edge Function would create them)
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000a1', 'admin@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c1', 'coach1@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c2', 'coach2@tests.invalid');
insert into public.profiles (id, full_name, email, role) values
  ('f0000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin@tests.invalid', 'admin'),
  ('f0000000-0000-0000-0000-0000000000c1', 'Coach One', 'coach1@tests.invalid', 'coach'),
  ('f0000000-0000-0000-0000-0000000000c2', 'Coach Two', 'coach2@tests.invalid', 'coach');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.profiles where email like '%@tests.invalid'), 1, 'coach reads only their own profile');
select throws_like($$update public.profiles set role = 'admin' where id = 'f0000000-0000-0000-0000-0000000000c1'$$, '%ajyal:forbidden_profile_change%', 'coach cannot promote themself');
select throws_like($$update public.profiles set monthly_salary_fils = 999999 where id = 'f0000000-0000-0000-0000-0000000000c1'$$, '%ajyal:forbidden_profile_change%', 'coach cannot change their salary');
select throws_like($$update public.profiles set active = false where id = 'f0000000-0000-0000-0000-0000000000c1'$$, '%ajyal:forbidden_profile_change%', 'coach cannot deactivate themself');
select throws_like($$update public.profiles set email = 'x@y.z' where id = 'f0000000-0000-0000-0000-0000000000c1'$$, '%ajyal:forbidden_profile_change%', 'coach cannot change their email');
select lives_ok($$update public.profiles set preferred_language = 'en' where id = 'f0000000-0000-0000-0000-0000000000c1'$$, 'coach can change their own language');
select lives_ok($$update public.profiles set preferred_language = 'en' where id = 'f0000000-0000-0000-0000-0000000000c2'$$, 'updating another profile is a silent no-op');
select tests.reset();
select is((select preferred_language from public.profiles where id = 'f0000000-0000-0000-0000-0000000000c1'), 'en', 'own language was saved');
select is((select preferred_language from public.profiles where id = 'f0000000-0000-0000-0000-0000000000c2'), 'ar', 'another coach''s profile is untouched');

select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.profiles where email like '%@tests.invalid'), 3, 'admin reads every profile');
select lives_ok($$update public.profiles set monthly_salary_fils = 250000 where id = 'f0000000-0000-0000-0000-0000000000c1'$$, 'admin can set a coach salary');
select tests.reset();
select is((select monthly_salary_fils from public.profiles where id = 'f0000000-0000-0000-0000-0000000000c1'), 250000, 'salary was saved');

-- Make the fixture admin the only active admin, then try to remove them.
update public.profiles set active = false where role = 'admin' and id <> 'f0000000-0000-0000-0000-0000000000a1';
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select throws_like($$update public.profiles set role = 'coach' where id = 'f0000000-0000-0000-0000-0000000000a1'$$, '%ajyal:last_admin%', 'last admin cannot be demoted');
select throws_like($$update public.profiles set active = false where id = 'f0000000-0000-0000-0000-0000000000a1'$$, '%ajyal:last_admin%', 'last admin cannot be deactivated');
select tests.reset();

-- ---------------------------------------------------------------------------
-- reference data: plans, settings
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.plans), 4, 'coach reads the four plans');
select is((select count(*)::int from public.settings), 1, 'coach reads settings');
select is(tests.affected($$update public.plans set price_fils = 1$$), 0, 'coach cannot change plan prices');
select is(tests.affected($$update public.settings set tshirt_fee_fils = 1$$), 0, 'coach cannot change settings');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is(tests.affected($$update public.plans set price_fils = 20000 where code = 'solo'$$), 1, 'admin can change plans');
select tests.reset();

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
insert into public.discounts (name, code, type, value, active) values
  ('Sibling', 'T-SIB10', 'percent', 1000, true),
  ('Old promo', 'T-OLD5', 'fixed', 5000, false);

select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select array_agg(code) from public.discounts where code like 'T-%'), array['T-SIB10'], 'coach sees only active discounts');
select throws_ok($$insert into public.discounts (name, code, type, value) values ('x', 'T-X1', 'fixed', 1)$$, '42501', null, 'coach cannot create discounts');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.discounts where code like 'T-%'), 2, 'admin sees all discounts');
select throws_ok($$insert into public.discounts (name, code, type, value) values ('n', 'T-BAD1', 'percent', 10001)$$, '23514', null, 'percent above 100% is rejected');
select throws_ok($$insert into public.discounts (name, code, type, value) values ('n', 'T-BAD2', 'fixed', 0)$$, '23514', null, 'zero value is rejected');
select throws_ok($$insert into public.discounts (name, code, type, value) values ('n', 't-sib10', 'fixed', 1000)$$, '23505', null, 'codes are unique case-insensitively');
select lives_ok($$insert into public.discounts (name, code, type, value) values ('n', 'T-OK15', 'percent', 1500)$$, 'admin can create a discount');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'discount.created' and summary ->> 'code' = 'T-OK15' and actor_id = 'f0000000-0000-0000-0000-0000000000a1'), 1, 'discount creation is logged with the admin as actor');

-- ---------------------------------------------------------------------------
-- subscriptions, subscription players, payments
-- ---------------------------------------------------------------------------
insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  ('f2000000-0000-0000-0000-000000000001', 'sub-own', '900000101', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f2000000-0000-0000-0000-000000000002', 'sub-other', '900000102', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c2');
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils)
  select 'f1000000-0000-0000-0000-000000000001', id, '2026-10-01', '2026-10-31', price_fils, price_fils from public.plans where code = 'duo';
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils)
  select 'f1000000-0000-0000-0000-000000000002', id, '2026-10-01', '2026-10-31', price_fils, price_fils from public.plans where code = 'solo';
insert into public.subscription_players (subscription_id, player_id) values
  ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002'),
  ('f1000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002');
insert into public.payments (subscription_id, amount_fils) values
  ('f1000000-0000-0000-0000-000000000001', 35000),
  ('f1000000-0000-0000-0000-000000000002', 20000);

select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select array_agg(id) from public.subscriptions where id in ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002')), array['f1000000-0000-0000-0000-000000000001']::uuid[], 'coach sees only subscriptions that include their player');
select is((select count(*)::int from public.payments where subscription_id in ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002')), 1, 'coach sees payments only of those subscriptions');
select is((select count(*)::int from public.subscription_players where subscription_id = 'f1000000-0000-0000-0000-000000000002'), 0, 'coach cannot see the players of a foreign subscription');
select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 20000 from public.plans where code = 'solo'$$, '42501', null, 'coach cannot write subscriptions directly');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.subscriptions where id in ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002')), 2, 'admin sees every subscription');
select is((select count(*)::int from public.subscription_players where subscription_id = 'f1000000-0000-0000-0000-000000000002'), 1, 'admin sees every subscription player');
select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 20000 from public.plans where code = 'solo'$$, '42501', null, 'not even an admin writes subscriptions directly (RPCs only)');
select throws_ok($$insert into public.payments (subscription_id, amount_fils) values ('f1000000-0000-0000-0000-000000000001', 1)$$, '42501', null, 'not even an admin writes payments directly (RPCs only)');
select tests.reset();

select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 19999 from public.plans where code = 'solo'$$, '23514', null, 'total must equal plan price');
select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, tshirt_total_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 5000, 20000 from public.plans where code = 'solo'$$, '23514', null, 'total must include fees');
select lives_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, tshirt_total_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 5000, 25000 from public.plans where code = 'solo'$$, 'a correct total with fees is accepted');
select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, tshirt_total_fils, discount_type, discount_value, discount_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 5000, 'percent', 1000, 2500, 22500 from public.plans where code = 'solo'$$, '23514', null, 'a manual discount needs a reason');
select lives_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, tshirt_total_fils, discount_type, discount_value, discount_reason, discount_fils, total_fils) select id, '2026-10-01', '2026-10-31', 20000, 5000, 'percent', 1000, 'Staff child', 2500, 22500 from public.plans where code = 'solo'$$, 'a manual discount with a reason is accepted');
select throws_ok($$insert into public.subscriptions (plan_id, start_date, end_date, plan_price_fils, total_fils) select id, '2026-10-31', '2026-10-01', 20000, 20000 from public.plans where code = 'solo'$$, '23514', null, 'end date cannot precede start date');

-- ---------------------------------------------------------------------------
-- training sessions and attendance
-- ---------------------------------------------------------------------------
select tests.reset();
insert into public.locations (id, name) values ('f4000000-0000-0000-0000-000000000001', 'ac-Location');
-- Sessions need a location: every session in this file gets this one by default (rolled back with the rest).
alter table public.training_sessions alter column location_id set default 'f4000000-0000-0000-0000-000000000001';
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select lives_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id) values ('2026-10-05', '16:00', '17:30', 'f0000000-0000-0000-0000-0000000000c1')$$, 'coach schedules their own session');
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select lives_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id) values ('2026-10-05', '16:00', '17:30', 'f0000000-0000-0000-0000-0000000000c2')$$, 'the other coach schedules theirs');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.training_sessions where coach_id in ('f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-0000000000c2')), 1, 'coach sees only their own sessions');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id) values ('2026-10-06', '16:00', '17:30', 'f0000000-0000-0000-0000-0000000000c2')$$, '42501', null, 'coach cannot schedule for another coach');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.training_sessions where coach_id in ('f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-0000000000c2')), 2, 'admin sees every session');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id) values ('2026-10-07', '17:00', '16:00', 'f0000000-0000-0000-0000-0000000000c1')$$, '23514', null, 'a session cannot end before it starts');
select lives_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id) values ('2026-10-07', '16:00', '17:00', 'f0000000-0000-0000-0000-0000000000c1')$$, 'admin schedules for any coach');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select lives_ok($$update public.training_sessions set cancelled_at = now() where coach_id = 'f0000000-0000-0000-0000-0000000000c1' and session_date = '2026-10-05'$$, 'coach cancels their session');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'session.created' and summary ->> 'coach_name' = 'Coach One'), 2, 'session creation is logged with the coach name');
select is((select count(*)::int from public.activity_log where action = 'session.cancelled' and actor_id = 'f0000000-0000-0000-0000-0000000000c1'), 1, 'session cancellation is logged');

insert into public.training_sessions (id, session_date, start_time, end_time, coach_id) values
  ('f3000000-0000-0000-0000-000000000001', '2026-11-01', '16:00', '17:00', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f3000000-0000-0000-0000-000000000002', '2026-11-01', '16:00', '17:00', 'f0000000-0000-0000-0000-0000000000c2');
insert into public.attendance (session_id, player_id, status) values
  ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'present'),
  ('f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'absent');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select array_agg(session_id) from public.attendance where session_id in ('f3000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000002')), array['f3000000-0000-0000-0000-000000000001']::uuid[], 'coach sees attendance only for their sessions');
select throws_ok($$insert into public.attendance (session_id, player_id, status) values ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'absent')$$, '42501', null, 'attendance cannot be written directly (save_attendance only)');
select tests.reset();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select lives_ok($$insert into public.expenses (category, amount_fils, description) values ('field_rent', 50000, 'T-rent')$$, 'admin records an expense');
select lives_ok($$insert into public.expenses (category, amount_fils, coach_id, description) values ('coach_salary', 50000, 'f0000000-0000-0000-0000-0000000000c1', 'T-salary')$$, 'admin records a salary');
select throws_ok($$insert into public.expenses (category, amount_fils) values ('coach_salary', 50000)$$, '23514', null, 'a salary needs a coach');
select throws_ok($$insert into public.expenses (category, amount_fils, coach_id) values ('field_rent', 50000, 'f0000000-0000-0000-0000-0000000000c1')$$, '23514', null, 'only salaries name a coach');
select is((select count(*)::int from public.expenses where description like 'T-%'), 2, 'admin reads expenses');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.expenses), 0, 'coach reads no expenses');
select throws_ok($$insert into public.expenses (category, amount_fils) values ('other', 1)$$, '42501', null, 'coach cannot create expenses');
select is(tests.affected($$delete from public.expenses$$), 0, 'coach cannot delete expenses');
select tests.reset();
select is((select count(*)::int from public.activity_log l join public.expenses e on e.id = l.entity_id where l.action = 'expense.created' and e.description = 'T-rent'), 1, 'an expense is logged');
select set_config('ajyal.bulk', 'on', true);
insert into public.expenses (category, amount_fils, description) values ('other', 100, 'T-bulk');
select set_config('ajyal.bulk', '', true);
select is((select count(*)::int from public.activity_log l join public.expenses e on e.id = l.entity_id where e.description = 'T-bulk'), 0, 'bulk generators suppress per-row activity');

-- ---------------------------------------------------------------------------
-- activity log
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select throws_ok($$insert into public.activity_log (action, entity_type) values ('fake.event', 'x')$$, '42501', null, 'coach cannot insert into activity_log');
select throws_ok($$update public.activity_log set action = 'tampered'$$, '42501', null, 'coach cannot update activity_log');
select throws_ok($$delete from public.activity_log$$, '42501', null, 'coach cannot delete from activity_log');
select throws_ok($$select public.log_activity('x', 'y', null)$$, '42501', null, 'coach cannot call log_activity');
select is((select count(*)::int from public.activity_log where actor_id is distinct from 'f0000000-0000-0000-0000-0000000000c1'), 0, 'coach sees only their own actions');
select ok((select count(*) from public.activity_log where actor_id = 'f0000000-0000-0000-0000-0000000000c1') > 0, 'coach sees their own actions');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select throws_ok($$insert into public.activity_log (action, entity_type) values ('fake.event', 'x')$$, '42501', null, 'admin cannot insert into activity_log');
select throws_ok($$update public.activity_log set action = 'tampered'$$, '42501', null, 'admin cannot update activity_log');
select throws_ok($$delete from public.activity_log$$, '42501', null, 'admin cannot delete from activity_log');
select throws_ok($$select public.log_activity('x', 'y', null)$$, '42501', null, 'admin cannot call log_activity');
select ok((select count(distinct actor_id) from public.activity_log where actor_id in ('f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-0000000000c2')) > 1, 'admin sees everyone''s actions');
select tests.act_as_anon();
select throws_ok($$insert into public.activity_log (action, entity_type) values ('fake.event', 'x')$$, '42501', null, 'anon cannot insert into activity_log');
select throws_ok($$select public.log_activity('x', 'y', null)$$, '42501', null, 'anon cannot call log_activity');
select tests.reset();

-- ---------------------------------------------------------------------------
-- privilege audit: guards against a future migration weakening security
-- ---------------------------------------------------------------------------
select is((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0, 'row level security is on for every public table');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('anon', c.oid, 'select,insert,update,delete')$$, 'anon has no privileges on any public table');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), array['public_locations', 'submit_player_applications'], 'anon (and PUBLIC) can execute only the two public registration functions (Phase 10: public_locations, submit_player_applications)');
select is((select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'delete')), array['expenses'], 'signed-in users can delete only expenses (admin-only by policy)');

select * from finish();
rollback;
