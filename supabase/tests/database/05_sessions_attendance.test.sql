-- Sessions & attendance: the sessions guard trigger, save_attendance (roster, upsert, atomicity, permissions,
-- logging), coach isolation and the player_attendance view.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = f8000000-…-n.
--   users: admin u(1), coach1 u(2), coach2 u(3), inactive coach u(4)
--   players: coach1 has u(11), u(12), u(13) and a removed one u(14); coach2 has u(21)
--   sessions (all today unless noted): u(101) cancel test, u(102) main attendance, u(103) attended then cancelled,
--             u(104) coach change, u(105) atomicity, u(106) tomorrow (no attendance yet), u(107) yesterday
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('f8000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- [{player_id, status}] for players given as small ints
create function tests.recs(p_present integer[], p_absent integer[] default '{}') returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('player_id', tests.u(i), 'status', st) order by i), '[]'::jsonb)
  from (
    select i, 'present'::text as st from unnest(p_present) as i
    union all
    select i, 'absent' from unnest(p_absent) as i
  ) x
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
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid'),
  (tests.u(3), 'coach2@tests.invalid'), (tests.u(4), 'coach3@tests.invalid');
insert into public.profiles (id, full_name, email, role, active) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin', true),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach', true),
  (tests.u(3), 'Coach Two', 'coach2@tests.invalid', 'coach', true),
  (tests.u(4), 'Coach Gone', 'coach3@tests.invalid', 'coach', false);

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  (tests.u(11), 'sa-A1', '920000011', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(12), 'sa-A2', '920000012', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(13), 'sa-A3', '920000013', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(14), 'sa-removed', '920000014', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(21), 'sa-B1', '920000021', '2015-01-01', '39000000', tests.u(3));
update public.players set deleted_at = now() where id = tests.u(14);

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- creating sessions: RLS + guard trigger
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, created_by)
  values (tests.u(101), public.today_bh(), '16:00', '17:30', tests.u(2), tests.u(1))$$, 'a coach schedules a session of their own');
select is((select created_by from public.training_sessions where id = tests.u(101)), tests.u(2), 'created_by is the caller, whatever was sent');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(3))$$, '42501', null, 'a coach cannot schedule for another coach');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '17:00', '16:00', tests.u(2))$$, '23514', null, 'the end must be after the start');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '16:00', '16:00', tests.u(2))$$, '23514', null, 'an empty time range is refused too');

select tests.act_as(tests.u(1));
select lives_ok($$insert into public.training_sessions (id, session_date, start_time, end_time, coach_id, location, cancelled_at)
  values (tests.u(102), public.today_bh(), '18:00', '19:00', tests.u(2), 'Field 2', now())$$, 'an admin schedules for a coach');
select is((select cancelled_at is null from public.training_sessions where id = tests.u(102)), true, 'a session cannot be created already cancelled');
select is((select created_by from public.training_sessions where id = tests.u(102)), tests.u(1), 'created_by is the admin');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(1))$$, '23514', 'ajyal:invalid_coach', 'an admin cannot be the session coach');
select throws_ok($$insert into public.training_sessions (session_date, start_time, end_time, coach_id)
  values (public.today_bh(), '16:00', '17:00', tests.u(4))$$, '23514', 'ajyal:invalid_coach', 'nor can an inactive coach');
select lives_ok($$insert into public.training_sessions (id, session_date, start_time, end_time, coach_id) values
  (tests.u(103), public.today_bh(), '16:00', '17:00', tests.u(2)),
  (tests.u(104), public.today_bh(), '16:00', '17:00', tests.u(2)),
  (tests.u(105), public.today_bh(), '16:00', '17:00', tests.u(2)),
  (tests.u(106), public.today_bh() + 1, '16:00', '17:00', tests.u(2)),
  (tests.u(107), public.today_bh() - 1, '16:00', '17:00', tests.u(2))$$, 'several sessions in one statement (repeat weekly)');
select tests.reset();

select is((select count(*)::int from public.activity_log where action = 'session.created' and entity_id = tests.u(101) and actor_id = tests.u(2)), 1, 'creation is logged once, by the coach');
select is((select summary ->> 'coach_name' from public.activity_log where action = 'session.created' and entity_id = tests.u(101)), 'Coach One', 'with a display snapshot');
select is((select count(*)::int from public.activity_log where action = 'session.created' and entity_id in (tests.u(103), tests.u(104), tests.u(105), tests.u(106), tests.u(107))), 5, 'each session of a batch is logged');

-- ---------------------------------------------------------------------------
-- isolation: a coach sees and edits only their own sessions
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(3));
select is_empty($$select id from public.training_sessions where id in (tests.u(101), tests.u(102))$$, 'coach 2 cannot see coach 1''s sessions');
select is(tests.affected($$update public.training_sessions set location = 'x' where id = tests.u(101)$$), 0, 'nor edit them');
select tests.act_as(tests.u(2));
select throws_ok($$update public.training_sessions set coach_id = tests.u(3) where id = tests.u(101)$$, '42501', null, 'a coach cannot hand a session to another coach');
select is((select count(*)::int from public.training_sessions where id between tests.u(101) and tests.u(107)), 7, 'a coach sees their own');
select tests.act_as(tests.u(1));
select is((select count(*)::int from public.training_sessions where id between tests.u(101) and tests.u(107)), 7, 'an admin sees every session');
select tests.reset();

-- ---------------------------------------------------------------------------
-- cancelling is final and stamped by the server
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$update public.training_sessions set cancelled_at = '2000-01-01' where id = tests.u(101)$$, 'a coach cancels their session');
select is((select cancelled_at = now() from public.training_sessions where id = tests.u(101)), true, 'the time is the server''s, not the client''s');
select throws_ok($$update public.training_sessions set location = 'x' where id = tests.u(101)$$, '55000', 'ajyal:session_cancelled', 'a cancelled session is read-only');
select throws_ok($$update public.training_sessions set cancelled_at = null where id = tests.u(101)$$, '55000', 'ajyal:session_cancelled', 'and cannot be revived');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'session.cancelled' and entity_id = tests.u(101) and actor_id = tests.u(2)), 1, 'the cancellation is logged once, by the coach');

-- ---------------------------------------------------------------------------
-- save_attendance: saving, correcting, roster
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11, 13], array[12]))$$, 'the session coach saves attendance');
select throws_ok($$select public.save_attendance(tests.u(106), tests.recs(array[11]))$$, '55000', 'ajyal:session_in_future', 'a coach cannot take attendance for a session dated tomorrow');
select is((select count(*)::int from public.attendance where session_id = tests.u(102)), 3, 'one row per player');
select is((select string_agg(status::text, ',' order by player_id) from public.attendance where session_id = tests.u(102)), 'present,absent,present', 'with the right statuses');
select is((select count(*)::int from public.attendance where session_id = tests.u(102) and marked_by = tests.u(2)), 3, 'marked by the coach');
select lives_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11, 12, 13]))$$, 'saving again corrects the marks');
select is((select count(*)::int from public.attendance where session_id = tests.u(102)), 3, 'without duplicating rows');
select is((select string_agg(status::text, ',' order by player_id) from public.attendance where session_id = tests.u(102)), 'present,present,present', 'the new statuses stick');

select tests.act_as(tests.u(1));
select lives_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11], array[12]))$$, 'an admin can save for any coach''s session, with a partial list');
select is((select string_agg(status::text, ',' order by player_id) from public.attendance where session_id = tests.u(102)), 'present,absent,present', 'a player not in the list keeps their mark');
select is((select marked_by from public.attendance where session_id = tests.u(102) and player_id = tests.u(11)), tests.u(2), 'an unchanged mark keeps who made it');
select is((select marked_by from public.attendance where session_id = tests.u(102) and player_id = tests.u(12)), tests.u(1), 'a changed mark records who changed it');

-- validation (each is refused with nothing written)
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[21]))$$, '22023', 'ajyal:not_on_roster', 'another coach''s player is not on the roster');
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[14]))$$, '22023', 'ajyal:not_on_roster', 'a removed player is not on the roster');
select throws_ok($$select public.save_attendance(tests.u(102), jsonb_build_array(jsonb_build_object('player_id', gen_random_uuid(), 'status', 'present')))$$, '22023', 'ajyal:not_on_roster', 'an unknown player is not on the roster');
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11, 11]))$$, '22023', 'ajyal:invalid_records', 'a player twice is refused');
select throws_ok($$select public.save_attendance(tests.u(102), '[]'::jsonb)$$, '22023', 'ajyal:invalid_records', 'an empty list is refused');
select throws_ok($$select public.save_attendance(tests.u(102), null)$$, '22023', 'ajyal:invalid_records', 'null is refused');
select throws_ok($$select public.save_attendance(tests.u(102), '{}'::jsonb)$$, '22023', 'ajyal:invalid_records', 'a non-list is refused');
select throws_ok($$select public.save_attendance(tests.u(102), '[1, 2]'::jsonb)$$, '22023', 'ajyal:invalid_records', 'a list of non-objects is refused');
select throws_ok($$select public.save_attendance(tests.u(102), jsonb_build_array(jsonb_build_object('player_id', tests.u(11), 'status', 'late')))$$, '22023', 'ajyal:invalid_records', 'only present and absent exist (D-023)');
select throws_ok($$select public.save_attendance(tests.u(102), jsonb_build_array(jsonb_build_object('player_id', 'nope', 'status', 'present')))$$, '22023', 'ajyal:invalid_records', 'a malformed player id is refused');
select throws_ok($$select public.save_attendance(tests.u(102), jsonb_build_array(jsonb_build_object('player_id', tests.u(11))))$$, '22023', 'ajyal:invalid_records', 'a record without a status is refused');
select throws_ok($$select public.save_attendance(tests.u(105), tests.recs(array[11], array[21]))$$, '22023', 'ajyal:not_on_roster', 'one bad record refuses the whole batch');
select is((select count(*)::int from public.attendance where session_id = tests.u(105)), 0, 'and nothing of it is saved');
select throws_ok($$select public.save_attendance(tests.u(101), tests.recs(array[11]))$$, '55000', 'ajyal:session_cancelled', 'a cancelled session cannot be marked');
select throws_ok($$select public.save_attendance(gen_random_uuid(), tests.recs(array[11]))$$, 'P0002', 'ajyal:session_not_found', 'an unknown session is not found');
select throws_ok($$select public.save_attendance(tests.u(106), tests.recs(array[11]))$$, '55000', 'ajyal:session_in_future', 'nor can an admin, for a session dated in the future');
select is((select count(*)::int from public.attendance where session_id = tests.u(106)), 0, 'and nothing is saved for it');
select lives_ok($$select public.save_attendance(tests.u(107), tests.recs(array[11], array[12]))$$, 'a session from yesterday can still be marked');
select lives_ok($$update public.training_sessions set session_date = public.today_bh() where id = tests.u(106)$$, 'a future session moved to today ...');
select lives_ok($$select public.save_attendance(tests.u(106), tests.recs(array[11]))$$, '... can be marked from then on');
select tests.reset();

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(3));
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11]))$$, 'P0002', 'ajyal:session_not_found', 'another coach cannot save it (and learns nothing about it)');
select is_empty($$select 1 from public.attendance where session_id = tests.u(102)$$, 'nor read its attendance');
select throws_ok($$insert into public.attendance (session_id, player_id, status) values (tests.u(105), tests.u(21), 'present')$$, '42501', null, 'clients cannot write attendance directly');
select throws_ok($$update public.attendance set status = 'absent'$$, '42501', null, 'nor update it');
select throws_ok($$delete from public.attendance$$, '42501', null, 'nor delete it');
select tests.act_as(tests.u(2));
select is((select count(*)::int from public.attendance where session_id = tests.u(102)), 3, 'the session coach reads their attendance');
select throws_ok($$insert into public.attendance (session_id, player_id, status) values (tests.u(105), tests.u(11), 'present')$$, '42501', null, 'and cannot write it directly either');
select tests.act_as_anon();
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11]))$$, '42501', null, 'anon cannot save attendance');
select throws_ok($$select * from public.player_attendance$$, '42501', null, 'anon cannot read the history view');
select tests.reset();

update public.profiles set active = false where id = tests.u(2);
select tests.act_as(tests.u(2));
select throws_ok($$select public.save_attendance(tests.u(102), tests.recs(array[11]))$$, '42501', 'ajyal:forbidden', 'a deactivated coach cannot save');
select tests.reset();
update public.profiles set active = true where id = tests.u(2);

select is((select has_function_privilege('authenticated', 'public.trg_sessions_guard()', 'execute')), false, 'the guard trigger function is not callable through the API');

-- ---------------------------------------------------------------------------
-- logging
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.activity_log where action = 'attendance.saved' and entity_id = tests.u(102)), 3, 'each successful save logs one entry (coach twice, admin once)');
select is((select count(*)::int from public.activity_log where action = 'attendance.saved' and entity_id = tests.u(102) and actor_id = tests.u(2) and (summary ->> 'present_count') || '/' || (summary ->> 'total_count') || '/' || (summary ->> 'actor_name') || '/' || (summary ->> 'coach_name') = '2/3/Coach One/Coach One'), 1, 'with counts and names as a snapshot (the first save: 2 of 3 present)');
select is((select count(*)::int from public.activity_log where action = 'attendance.saved' and entity_id in (tests.u(105), tests.u(101))), 0, 'refused saves are not logged (cancelled, future, invalid)');

-- ---------------------------------------------------------------------------
-- moving a session between coaches
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select throws_ok($$update public.training_sessions set coach_id = tests.u(3) where id = tests.u(102)$$, '55000', 'ajyal:session_has_attendance', 'a session with attendance keeps its coach');
select lives_ok($$update public.training_sessions set coach_id = tests.u(3) where id = tests.u(104)$$, 'one without can move to another coach');
select throws_ok($$select public.save_attendance(tests.u(104), tests.recs(array[11]))$$, '22023', 'ajyal:not_on_roster', 'and its roster follows the new coach');
select lives_ok($$select public.save_attendance(tests.u(104), tests.recs(array[21]))$$, 'that coach''s players are on it');
select throws_ok($$update public.training_sessions set coach_id = tests.u(4) where id = tests.u(105)$$, '23514', 'ajyal:invalid_coach', 'an inactive coach cannot take it');
select tests.reset();

-- ---------------------------------------------------------------------------
-- player_attendance: history and rate (cancelled sessions are left out; RLS applies to the caller)
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select lives_ok($$select public.save_attendance(tests.u(103), tests.recs(array[11]))$$, 'attendance is taken for a session ...');
select tests.act_as(tests.u(2));
select lives_ok($$update public.training_sessions set cancelled_at = now() where id = tests.u(103)$$, '... which is then cancelled');
select is((select count(*)::int from public.player_attendance where player_id = tests.u(11)), 3, 'the history skips the cancelled session (sessions 102, 106 and 107 count)');
select is((select count(*)::int from public.attendance where player_id = tests.u(11)), 4, 'though its mark is kept');
select is((select status::text || '/' || session_date::text from public.player_attendance where player_id = tests.u(11) and session_id = tests.u(102)), 'present/' || public.today_bh()::text, 'a row carries the status and the session date');
select is((select count(*)::int from public.player_attendance where player_id = tests.u(11) and status = 'present'), 3, 'the rate can be counted from it');
select tests.act_as(tests.u(3));
select is_empty($$select 1 from public.player_attendance where player_id in (tests.u(11), tests.u(12), tests.u(13))$$, 'another coach sees no history of these players');
select tests.act_as(tests.u(1));
select is((select count(*)::int from public.player_attendance where player_id in (tests.u(11), tests.u(12), tests.u(13))), 6, 'an admin sees it all (3 + 1 + 2 marks)');
select tests.reset();

select * from finish();
rollback;
