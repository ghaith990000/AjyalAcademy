-- Public player registration (Phase 10): the anonymous door (two functions, nothing else), its input checks, honeypot,
-- idempotent retry and rate limits; the admin-only review (list, accept, reject) and the activity trail.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = fa000000-…-n.
--   users: admin u(1), coach1 u(2), coach2 u(3), inactive admin u(4), inactive coach u(5)
--   locations: L1 u(101) "pa-Rifa" active, L2 u(102) "pa-Old" inactive
--   players: u(11) belongs to coach1 with CPR 950000011; u(12) is removed, CPR 950000012
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
-- one child as the form sends it
create function tests.child(p_name text, p_cpr text) returns jsonb language sql immutable as $$
  select jsonb_build_object('full_name', p_name, 'cpr', p_cpr, 'date_of_birth', '2015-05-05')
$$;
-- a submission with one child from a phone number (submission id = tests.u(n))
create function tests.submit_one(p_n integer, p_phone text) returns void language sql as $$
  select public.submit_player_applications(
    tests.u(p_n), 'pa-Parent', p_phone, null, 'en', jsonb_build_array(tests.child('pa-Kid ' || p_n, '95' || lpad(p_n::text, 7, '0')))
  )
$$;
-- accept and compare the returned id with the application's player (a plpgsql statement sees its own changes)
create function tests.accept_returns_player(p_app uuid, p_coach uuid, p_loc uuid) returns boolean language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.accept_player_application(p_app, p_coach, p_loc);
  return v_id = (select player_id from public.player_applications where id = p_app);
end $$;
-- the DETAIL line of the error a statement raises (null when it does not fail)
create function tests.detail_of(p_sql text) returns text language plpgsql as $$
declare d text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $$;
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
-- The hosted project may hold real rows: everything below is rolled back, but the counts must be exact.
delete from public.player_applications;

insert into auth.users (id, email) values
  (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid'), (tests.u(3), 'coach2@tests.invalid'),
  (tests.u(4), 'idle-admin@tests.invalid'), (tests.u(5), 'idle-coach@tests.invalid');
insert into public.profiles (id, full_name, email, role, active) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin', true),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach', true),
  (tests.u(3), 'Coach Two', 'coach2@tests.invalid', 'coach', true),
  (tests.u(4), 'Idle Admin', 'idle-admin@tests.invalid', 'admin', false),
  (tests.u(5), 'Idle Coach', 'idle-coach@tests.invalid', 'coach', false);

insert into public.locations (id, name, active) values (tests.u(101), 'pa-Rifa', true), (tests.u(102), 'pa-Old', false);

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  (tests.u(11), 'pa-Existing', '950000011', '2015-01-01', '39000000', tests.u(2));
insert into public.players (id, full_name, cpr, date_of_birth, phone) values
  (tests.u(12), 'pa-Removed', '950000012', '2015-01-01', '39000000');
update public.players set deleted_at = now() where id = tests.u(12);

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- the anonymous door: two functions and no tables
-- ---------------------------------------------------------------------------
select tests.act_as_anon();
select is((select array_agg(name order by name) from public.public_locations() where name like 'pa-%'), array['pa-Rifa'], 'anon sees the active locations only');
select throws_ok($$select * from public.player_applications$$, '42501', null, 'anon cannot read applications');
select throws_ok($$select * from public.player_application_overview$$, '42501', null, 'nor the admin list');
select throws_ok($$select * from public.players$$, '42501', null, 'nor players');
select throws_ok($$insert into public.player_applications (submission_id, child_index, guardian_name, phone, language, full_name, cpr, date_of_birth) values (gen_random_uuid(), 1, 'x', '39000000', 'en', 'x', '950000099', '2015-01-01')$$, '42501', null, 'anon cannot insert an application directly');
select throws_ok($$update public.player_applications set status = 'accepted'$$, '42501', null, 'nor update one');
select throws_ok($$delete from public.player_applications$$, '42501', null, 'nor delete one');
select throws_ok($$select public.accept_player_application(tests.u(999), null, null)$$, '42501', null, 'anon cannot accept');
select throws_ok($$select public.reject_player_application(tests.u(999), null)$$, '42501', null, 'anon cannot reject');

-- a good submission: two children, one parent
select lives_ok($$select public.submit_player_applications(tests.u(201), '  pa-Parent  ', '3900 1234', tests.u(101), 'ar',
  jsonb_build_array(
    jsonb_build_object('full_name', '  pa-Ali  ', 'cpr', '950000021', 'date_of_birth', '2014-03-04', 'address', '  ', 'school', 'pa-School',
      'has_disease', false, 'disease_description', 'ignored when there is no condition'),
    jsonb_build_object('full_name', 'pa-Sara', 'cpr', '950000022', 'date_of_birth', '2016-06-07', 'has_disease', true, 'disease_description', 'asthma')
  ))$$, 'anon submits two children');
select tests.reset();
select is((select count(*)::int from public.player_applications where submission_id = tests.u(201)), 2, 'both are stored');
select is((select array_agg(child_index order by child_index) from public.player_applications where submission_id = tests.u(201)), array[1, 2]::smallint[], 'in the order sent');
select is((select guardian_name || '/' || phone || '/' || language || '/' || status from public.player_applications where submission_id = tests.u(201) and child_index = 1), 'pa-Parent/39001234/ar/pending', 'the parent''s name is trimmed, spaces leave the phone number, the language is kept, and it waits');
select is((select full_name || '/' || coalesce(address, 'null') || '/' || school || '/' || has_disease || '/' || coalesce(disease_description, 'null') from public.player_applications where submission_id = tests.u(201) and child_index = 1), 'pa-Ali/null/pa-School/false/null', 'names are trimmed, a blank address is nothing, a description is dropped when there is no condition');
select is((select disease_description from public.player_applications where submission_id = tests.u(201) and child_index = 2), 'asthma', 'a condition keeps its description');
select is((select count(*)::int from public.activity_log where action = 'application.submitted' and entity_id = tests.u(201) and actor_id is null), 1, 'one feed entry for the whole submission, with no actor');
select is((select summary ->> 'child_count' || '/' || (summary -> 'child_names') ::text || '/' || (summary ->> 'location_name') from public.activity_log where action = 'application.submitted'), '2/["pa-Ali", "pa-Sara"]/pa-Rifa', 'it names the children and the location');

-- a retry of the same submission is recognised
select tests.act_as_anon();
select lives_ok($$select public.submit_player_applications(tests.u(201), 'pa-Parent', '39001234', tests.u(101), 'ar', jsonb_build_array(tests.child('pa-Ali', '950000021')))$$, 'sending the same submission again succeeds');
select tests.reset();
select is((select count(*)::int from public.player_applications where submission_id = tests.u(201)), 2, 'without adding anything');
select is((select count(*)::int from public.activity_log where action = 'application.submitted'), 1, 'or logging it again');

-- the honeypot: a bot fills the hidden field and is told it worked
select tests.act_as_anon();
select lives_ok($$select public.submit_player_applications(tests.u(202), 'pa-Bot', '39001234', null, 'en', jsonb_build_array(tests.child('pa-Bot kid', '950000031')), 'http://spam.example')$$, 'a filled honeypot looks like a success');
select lives_ok($$select public.submit_player_applications(tests.u(203), 'pa-Human', '39001235', null, 'en', jsonb_build_array(tests.child('pa-Human kid', '950000032')), '   ')$$, 'a blank one is a person');
select tests.reset();
select is((select count(*)::int from public.player_applications where submission_id = tests.u(202)), 0, 'but nothing was stored for the bot');
select is((select count(*)::int from public.player_applications where submission_id = tests.u(203)), 1, 'and the person was stored');
select is((select count(*)::int from public.activity_log where action = 'application.submitted' and entity_id = tests.u(202)), 0, 'the bot is not in the feed either');

-- input checks
select tests.act_as_anon();
select throws_ok($$select public.submit_player_applications(null, 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a submission needs an id');
select throws_ok($$select public.submit_player_applications(tests.u(210), '  ', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a blank parent name is refused');
select throws_ok($$select public.submit_player_applications(tests.u(210), repeat('x', 121), '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'so is a 121-character one');
select throws_ok($$select public.submit_player_applications(tests.u(210), 'pa-P', '1234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a phone number of fewer than 8 digits is refused');
select throws_ok($$select public.submit_player_applications(tests.u(210), 'pa-P', '3900-1234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'so are dashes');
select lives_ok($$select public.submit_player_applications(tests.u(211), 'pa-P', '+973 3900 1234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000042')))$$, 'a +973 number with spaces is accepted');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'fr', jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'only Arabic and English are languages');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, null, jsonb_build_array(tests.child('pa-K', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a language is required');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', '[]'::jsonb)$$, '22023', 'ajyal:invalid_input', 'at least one child');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', '{"a":1}'::jsonb)$$, '22023', 'ajyal:invalid_input', 'the children must be a list');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', null)$$, '22023', 'ajyal:invalid_input', 'and present');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', '[1]'::jsonb)$$, '22023', 'ajyal:invalid_input', 'each child an object');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '95000004')))$$, '22023', 'ajyal:invalid_input', 'a CPR of 8 digits is refused');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '95000004a')))$$, '22023', 'ajyal:invalid_input', 'a CPR with a letter too');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('  ', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a blank child name');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041')))$$, '22023', 'ajyal:invalid_input', 'a missing date of birth');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', 'not-a-date')))$$, '22023', 'ajyal:invalid_input', 'a date that is not a date');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', ((now() at time zone 'Asia/Bahrain')::date)::text)))$$, '22023', 'ajyal:invalid_input', 'a birth date of today (not in the past)');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', '1985-01-01')))$$, '22023', 'ajyal:invalid_input', 'or before 1990');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', '2015-01-01', 'has_disease', true)))$$, '22023', 'ajyal:invalid_input', 'a condition needs a description');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', '2015-01-01', 'has_disease', 'maybe')))$$, '22023', 'ajyal:invalid_input', 'a condition flag that is not true or false');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(jsonb_build_object('full_name', 'pa-K', 'cpr', '950000041', 'date_of_birth', '2015-01-01', 'address', repeat('x', 201))))$$, '22023', 'ajyal:invalid_input', 'an address over 200 characters');
select throws_ok($$select public.submit_player_applications(tests.u(212), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K1', '950000051'), tests.child('pa-K2', '950000052'), tests.child('pa-K3', '950000053'), tests.child('pa-K4', '950000054'), tests.child('pa-K5', '950000055')))$$, '22023', 'ajyal:too_many_children', 'five children are too many');
select lives_ok($$select public.submit_player_applications(tests.u(213), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K1', '950000051'), tests.child('pa-K2', '950000052'), tests.child('pa-K3', '950000053'), tests.child('pa-K4', '950000054')))$$, 'four are fine');
select throws_ok($$select public.submit_player_applications(tests.u(214), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K1', '950000061'), tests.child('pa-K2', '950000061')))$$, '22023', 'ajyal:duplicate_child', 'the same CPR twice in one submission is refused');
select throws_ok($$select public.submit_player_applications(tests.u(215), 'pa-P', '39001234', tests.u(102), 'en', jsonb_build_array(tests.child('pa-K', '950000071')))$$, '22023', 'ajyal:invalid_location', 'a switched-off location is refused');
select throws_ok($$select public.submit_player_applications(tests.u(215), 'pa-P', '39001234', tests.u(999), 'en', jsonb_build_array(tests.child('pa-K', '950000071')))$$, '22023', 'ajyal:invalid_location', 'so is an unknown one');
select lives_ok($$select public.submit_player_applications(tests.u(216), 'pa-P', '39001234', null, 'en', jsonb_build_array(tests.child('pa-K', '950000072')))$$, 'no location at all is fine');
-- no oracle: a CPR that is already a player, or already waiting, is accepted without a word
select lives_ok($$select public.submit_player_applications(tests.u(217), 'pa-P', '39001240', null, 'en', jsonb_build_array(tests.child('pa-Copy of a player', '950000011')))$$, 'a CPR that is already a player looks the same as any other');
select lives_ok($$select public.submit_player_applications(tests.u(218), 'pa-P', '39001241', null, 'en', jsonb_build_array(tests.child('pa-Copy of a request', '950000021')))$$, 'so does one that is already waiting');
select tests.reset();
select is((select count(*)::int from public.player_applications where submission_id in (tests.u(210), tests.u(212), tests.u(214), tests.u(215))), 0, 'a refused submission stores nothing (not even its first child)');
select is((select count(*)::int from public.player_applications where submission_id = tests.u(213)), 4, 'four children stored together');

-- ---------------------------------------------------------------------------
-- rate limits
-- ---------------------------------------------------------------------------
delete from public.player_applications;
select tests.act_as_anon();
select lives_ok($$select tests.submit_one(301, '39002001')$$, 'first submission from a phone number');
select lives_ok($$select tests.submit_one(302, '39002001')$$, 'second');
select lives_ok($$select tests.submit_one(303, '3900 2001')$$, 'third (typed with a space)');
select lives_ok($$select tests.submit_one(304, '+97339002001')$$, 'fourth (with the country code)');
select lives_ok($$select tests.submit_one(305, '39002001')$$, 'fifth');
select throws_ok($$select tests.submit_one(306, '39002001')$$, '54000', 'ajyal:rate_limited', 'the sixth in a day is refused');
select throws_ok($$select tests.submit_one(307, '+973 3900 2001')$$, '54000', 'ajyal:rate_limited', 'however the number is written');
select lives_ok($$select tests.submit_one(308, '39002002')$$, 'another phone number is not affected');
select lives_ok($$select tests.submit_one(301, '39002001')$$, 'a retry of a stored submission still goes through');
select tests.reset();
update public.player_applications set created_at = now() - interval '2 days' where submission_id in (tests.u(301), tests.u(302));
select tests.act_as_anon();
select lives_ok($$select tests.submit_one(309, '39002001')$$, 'after a day the number can be used again (only three counted)');
select tests.reset();

-- 60 an hour for everyone
delete from public.player_applications;
insert into public.player_applications (submission_id, child_index, guardian_name, phone, language, full_name, cpr, date_of_birth)
select gen_random_uuid(), 1, 'pa-Load', '3910' || lpad(g::text, 4, '0'), 'en', 'pa-Load ' || g, '96' || lpad(g::text, 7, '0'), '2015-01-01'
from generate_series(1, 60) g;
select tests.act_as_anon();
select throws_ok($$select tests.submit_one(310, '39003001')$$, '54000', 'ajyal:rate_limited', 'sixty submissions in the last hour close the door for everyone');
select tests.reset();
update public.player_applications set created_at = now() - interval '2 hours';
select tests.act_as_anon();
select lives_ok($$select tests.submit_one(311, '39003001')$$, 'an hour later it opens again');
select tests.reset();

-- 300 a day for everyone
delete from public.player_applications;
insert into public.player_applications (submission_id, child_index, guardian_name, phone, language, full_name, cpr, date_of_birth, created_at)
select gen_random_uuid(), 1, 'pa-Load', '3920' || lpad(g::text, 4, '0'), 'en', 'pa-Load ' || g, '97' || lpad(g::text, 7, '0'), '2015-01-01', now() - interval '3 hours'
from generate_series(1, 300) g;
select tests.act_as_anon();
select throws_ok($$select tests.submit_one(312, '39004001')$$, '54000', 'ajyal:rate_limited', 'three hundred in a day close it');
select tests.reset();
update public.player_applications set created_at = now() - interval '2 days';
select tests.act_as_anon();
select lives_ok($$select tests.submit_one(313, '39004001')$$, 'and the next day it opens');
select tests.reset();

-- ---------------------------------------------------------------------------
-- who can see and decide
-- ---------------------------------------------------------------------------
delete from public.player_applications;
delete from public.activity_log;
insert into public.player_applications (id, submission_id, child_index, guardian_name, phone, language, location_id, full_name, cpr, date_of_birth, address, school, has_disease, disease_description) values
  (tests.u(401), tests.u(451), 1, 'pa-Mother', '39005001', 'ar', tests.u(101), 'pa-Noor', '950000101', '2014-02-02', 'Road 5', 'pa-School', true, 'asthma'),
  (tests.u(402), tests.u(451), 2, 'pa-Mother', '39005001', 'ar', tests.u(101), 'pa-Omar', '950000102', '2016-02-02', null, null, false, null),
  (tests.u(403), tests.u(452), 1, 'pa-Father', '39005002', 'en', null, 'pa-Copy', '950000011', '2015-01-01', null, null, false, null),
  (tests.u(404), tests.u(453), 1, 'pa-Aunt', '39005003', 'en', null, 'pa-Twin A', '950000103', '2015-01-01', null, null, false, null),
  (tests.u(405), tests.u(454), 1, 'pa-Uncle', '39005004', 'en', tests.u(102), 'pa-Twin B', '950000103', '2015-01-01', null, null, false, null),
  (tests.u(406), tests.u(455), 1, 'pa-Cousin', '39005005', 'en', null, 'pa-Was removed', '950000012', '2015-01-01', null, null, false, null),
  (tests.u(407), tests.u(456), 1, 'pa-Friend', '39005006', 'en', null, 'pa-Plain', '950000104', '2015-01-01', null, null, false, null),
  (tests.u(408), tests.u(457), 1, 'pa-Neighbour', '39005007', 'en', null, 'pa-To reject', '950000105', '2015-01-01', null, null, false, null);

select tests.act_as(tests.u(2));
select is((select count(*)::int from public.player_applications), 0, 'a coach sees no applications');
select is((select count(*)::int from public.player_application_overview), 0, 'nor the admin list');
select throws_ok($$select public.accept_player_application(tests.u(401), null, null)$$, '42501', 'ajyal:forbidden', 'a coach cannot accept');
select throws_ok($$select public.reject_player_application(tests.u(401), null)$$, '42501', 'ajyal:forbidden', 'nor reject');
select throws_ok($$insert into public.player_applications (submission_id, child_index, guardian_name, phone, language, full_name, cpr, date_of_birth) values (gen_random_uuid(), 1, 'x', '39000000', 'en', 'x', '950000099', '2015-01-01')$$, '42501', null, 'nor insert one');
select tests.act_as(tests.u(4));
select is((select count(*)::int from public.player_applications), 0, 'an inactive admin sees none');
select throws_ok($$select public.accept_player_application(tests.u(401), null, null)$$, '42501', 'ajyal:forbidden', 'and cannot accept');
select tests.act_as(tests.u(1));
select is((select count(*)::int from public.player_applications), 8, 'an admin sees all of them');
select throws_ok($$insert into public.player_applications (submission_id, child_index, guardian_name, phone, language, full_name, cpr, date_of_birth) values (gen_random_uuid(), 1, 'x', '39000000', 'en', 'x', '950000099', '2015-01-01')$$, '42501', null, 'but does not insert one by hand');
select throws_ok($$update public.player_applications set status = 'accepted' where id = tests.u(401)$$, '42501', null, 'nor update');
select throws_ok($$delete from public.player_applications where id = tests.u(401)$$, '42501', null, 'nor delete');

-- the admin list and its warnings
select is((select location_name from public.player_application_overview where id = tests.u(401)), 'pa-Rifa', 'the list carries the location name');
select is((select existing_player_id || '/' || existing_player_name from public.player_application_overview where id = tests.u(403)), tests.u(11) || '/pa-Existing', 'a CPR that is already a player is flagged with that player');
select is((select existing_player_id from public.player_application_overview where id = tests.u(406)), null, 'a removed player''s CPR is free');
select is((select same_cpr_pending from public.player_application_overview where id = tests.u(404)), 1, 'a CPR waiting in another application is flagged');
select is((select same_cpr_pending from public.player_application_overview where id = tests.u(405)), 1, 'on both sides');
select is((select same_cpr_pending from public.player_application_overview where id = tests.u(407)), 0, 'an ordinary one has no warning');

-- accepting
select ok(tests.accept_returns_player(tests.u(401), tests.u(2), tests.u(101)), 'accepting returns the new player''s id');
select is((select full_name || '/' || cpr || '/' || date_of_birth || '/' || address || '/' || school || '/' || phone || '/' || has_disease || '/' || disease_description || '/' || guardian_name from public.players where id = (select player_id from public.player_applications where id = tests.u(401))), 'pa-Noor/950000101/2014-02-02/Road 5/pa-School/39005001/true/asthma/pa-Mother', 'the player has the application''s data and the parent''s name');
select is((select coach_id || '/' || location_id || '/' || created_by from public.players where id = (select player_id from public.player_applications where id = tests.u(401))), tests.u(2) || '/' || tests.u(101) || '/' || tests.u(1), 'with the chosen coach and location, created by the admin');
select is((select status || '/' || (decided_by = tests.u(1)) || '/' || (decided_at is not null) from public.player_applications where id = tests.u(401)), 'accepted/true/true', 'the application is marked accepted, by whom and when');
select is((select existing_player_id from public.player_application_overview where id = tests.u(401)), null, 'a decided application shows no warnings');
select is((select decided_by_name from public.player_application_overview where id = tests.u(401)), 'Admin A', 'and names who decided');
select throws_ok($$select public.accept_player_application(tests.u(401), null, null)$$, '55000', 'ajyal:already_decided', 'a decided application cannot be accepted again');
select throws_ok($$select public.reject_player_application(tests.u(401), null)$$, '55000', 'ajyal:already_decided', 'nor rejected');
select is((select count(*)::int from public.players where cpr = '950000101'), 1, 'exactly one player was made');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'application.accepted' and entity_id = tests.u(401) and actor_id = tests.u(1)), 1, 'accepting is logged once, by the admin');
select is((select summary ->> 'player_name' || '/' || (summary ->> 'coach_name') || '/' || (summary ->> 'location_name') || '/' || (summary ->> 'guardian_name') from public.activity_log where action = 'application.accepted'), 'pa-Noor/Coach One/pa-Rifa/pa-Mother', 'with the player, coach, location and parent');
select is((select count(*)::int from public.activity_log where action = 'player.created' and summary ->> 'player_name' = 'pa-Noor'), 0, 'and the player''s own "created" entry is not added on top');
select tests.act_as(tests.u(1));

-- accepting without a coach or location, and what refuses
select lives_ok($$select public.accept_player_application(tests.u(402), null, null)$$, 'a player can be accepted with no coach and no location');
select is((select coach_id is null and location_id is null from public.players where cpr = '950000102'), true, 'and has neither');
select throws_ok($$select public.accept_player_application(tests.u(403), null, null)$$, '23505', 'ajyal:cpr_taken', 'a CPR that is already a player is refused');
select is((select status::text from public.player_applications where id = tests.u(403)), 'pending', 'the application stays pending');
select is(tests.detail_of($$select public.accept_player_application(tests.u(403), null, null)$$), tests.u(11)::text, 'and the refusal names the existing player');
select throws_ok($$select public.accept_player_application(tests.u(404), tests.u(1), null)$$, '22023', 'ajyal:invalid_coach', 'an admin is not a coach');
select throws_ok($$select public.accept_player_application(tests.u(404), tests.u(5), null)$$, '22023', 'ajyal:invalid_coach', 'nor is an inactive coach');
select throws_ok($$select public.accept_player_application(tests.u(404), tests.u(999), null)$$, '22023', 'ajyal:invalid_coach', 'nor an unknown one');
select throws_ok($$select public.accept_player_application(tests.u(404), null, tests.u(102))$$, '22023', 'ajyal:invalid_location', 'a switched-off location is refused');
select throws_ok($$select public.accept_player_application(tests.u(404), null, tests.u(999))$$, '22023', 'ajyal:invalid_location', 'so is an unknown one');
select is((select status::text from public.player_applications where id = tests.u(404)), 'pending', 'a refused acceptance changes nothing');
select is((select count(*)::int from public.players where cpr = '950000103'), 0, 'and creates no player');
select lives_ok($$select public.accept_player_application(tests.u(404), tests.u(3), null)$$, 'the first of two with the same CPR is accepted');
select throws_ok($$select public.accept_player_application(tests.u(405), null, null)$$, '23505', 'ajyal:cpr_taken', 'the second is then refused: the CPR is taken');
select lives_ok($$select public.accept_player_application(tests.u(406), null, null)$$, 'a removed player''s CPR does not block');
select throws_ok($$select public.accept_player_application(tests.u(999), null, null)$$, 'P0002', 'ajyal:application_not_found', 'an unknown application');

-- rejecting
select throws_ok($$select public.reject_player_application(tests.u(408), repeat('x', 501))$$, '22023', 'ajyal:invalid_input', 'a note over 500 characters is refused');
select lives_ok($$select public.reject_player_application(tests.u(408), '  no places left  ')$$, 'rejecting takes a note');
select is((select status || '/' || decision_note || '/' || (decided_by = tests.u(1)) || '/' || (player_id is null) from public.player_applications where id = tests.u(408)), 'rejected/no places left/true/true', 'trimmed, with who decided and no player');
select is((select count(*)::int from public.players where cpr = '950000105'), 0, 'no player is made');
select lives_ok($$select public.reject_player_application(tests.u(407))$$, 'the note is optional');
select is((select decision_note from public.player_applications where id = tests.u(407)), null, 'and stays empty');
select throws_ok($$select public.reject_player_application(tests.u(408), null)$$, '55000', 'ajyal:already_decided', 'a rejected application cannot be rejected again');
select throws_ok($$select public.accept_player_application(tests.u(408), null, null)$$, '55000', 'ajyal:already_decided', 'nor accepted (the parent can register again)');
select throws_ok($$select public.reject_player_application(tests.u(999), null)$$, 'P0002', 'ajyal:application_not_found', 'an unknown application');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'application.rejected'), 2, 'each rejection is logged');
select is((select summary ->> 'player_name' || '/' || (summary ->> 'guardian_name') from public.activity_log where action = 'application.rejected' and entity_id = tests.u(408)), 'pa-To reject/pa-Neighbour', 'with the child and the parent');
select tests.act_as(tests.u(2));
select is((select count(*)::int from public.activity_log where entity_type = 'application'), 0, 'a coach sees none of it in the feed');
select tests.reset();

-- a parent can register again after a rejection
select tests.act_as_anon();
select lives_ok($$select public.submit_player_applications(tests.u(470), 'pa-Neighbour', '39005007', null, 'en', jsonb_build_array(tests.child('pa-To reject', '950000105')))$$, 'a rejected child can be submitted again');
select tests.reset();
select is((select count(*)::int from public.player_applications where cpr = '950000105' and status = 'pending'), 1, 'as a new application');

-- the guardian's name on a player
select tests.act_as(tests.u(1));
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, guardian_name) values ('pa-G', '950000201', '2015-01-01', '39000000', '  ')$$, '23514', null, 'a blank guardian name is refused');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, guardian_name) values ('pa-G', '950000201', '2015-01-01', '39000000', repeat('x', 121))$$, '23514', null, 'so is a 121-character one');
select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, guardian_name) values ('pa-G', '950000201', '2015-01-01', '39000000', 'pa-Guardian')$$, 'an admin can record one when adding a player');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'player.created' and summary ->> 'player_name' = 'pa-G'), 1, 'and a player added by hand is still logged as created');

-- ---------------------------------------------------------------------------
-- privilege audit: the anonymous door is exactly these two functions
-- ---------------------------------------------------------------------------
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), array['public_locations', 'submit_player_applications'], 'anon can execute exactly the two public functions');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('anon', c.oid, 'select,insert,update,delete')$$, 'anon still has no privileges on any public table');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('accept_player_application', 'reject_player_application') and has_function_privilege('anon', p.oid, 'execute')$$, 'the decision functions are closed to anon');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'player_applications'), 1, 'the applications table has one policy (admin select)');
select is((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'player_applications'), true, 'with row level security on');

select * from finish();
rollback;
