-- Players: coach isolation, ownership rules, soft delete, data constraints, activity logging.
-- See 01_access_control.test.sql for how to run and for the fixture ids.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

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

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000a1', 'admin@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c1', 'coach1@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c2', 'coach2@tests.invalid');
insert into public.profiles (id, full_name, email, role) values
  ('f0000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin@tests.invalid', 'admin'),
  ('f0000000-0000-0000-0000-0000000000c1', 'Coach One', 'coach1@tests.invalid', 'coach'),
  ('f0000000-0000-0000-0000-0000000000c2', 'Coach Two', 'coach2@tests.invalid', 'coach');

-- Player fixtures (fixed ids so RPC calls do not depend on what RLS lets a coach look up).
insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  ('f4000000-0000-0000-0000-000000000001', 'vis-c1-a', '900000401', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000002', 'vis-c2-a', '900000402', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c2'),
  ('f4000000-0000-0000-0000-000000000003', 'vis-unassigned', '900000403', '2015-01-01', '39000000', null),
  ('f4000000-0000-0000-0000-000000000004', 'inactive-c2', '900000404', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c2'),
  ('f4000000-0000-0000-0000-000000000005', 'not-yours', '900000405', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c2'),
  ('f4000000-0000-0000-0000-000000000006', 'reassign-attempt', '900000406', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000007', 'to-remove', '900000407', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000008', 'not-mine-to-remove', '900000408', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c2'),
  ('f4000000-0000-0000-0000-000000000009', 'remove-once', '900000409', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000010', 'direct-delete', '900000410', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000011', 'restore-me', '900000411', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000012', 'admin-moves-me', '900000412', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f4000000-0000-0000-0000-000000000013', 'edit-me', '900000413', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1');

-- ---------------------------------------------------------------------------
-- visibility (RLS)
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select array_agg(full_name order by full_name) from public.players where full_name like 'vis-%'), array['vis-c1-a'], 'coach 1 sees only their own players');
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select is((select array_agg(full_name order by full_name) from public.players where full_name like 'vis-%'), array['vis-c2-a'], 'coach 2 sees only their own players');
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select array_agg(full_name order by full_name) from public.players where full_name like 'vis-%'), array['vis-c1-a', 'vis-c2-a', 'vis-unassigned'], 'admin sees every player, assigned or not');
select tests.act_as_anon();
select throws_ok($$select * from public.players$$, '42501', null, 'anon has no access to players');
select tests.reset();

update public.profiles set active = false where id = 'f0000000-0000-0000-0000-0000000000c2';
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.players where full_name = 'inactive-c2'), 0, 'a deactivated coach sees no players');
select is((select count(*)::int from public.plans), 0, 'a deactivated coach reads no reference data either');
select tests.reset();
update public.profiles set active = true where id = 'f0000000-0000-0000-0000-0000000000c2';

-- ---------------------------------------------------------------------------
-- writes by a coach
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is(tests.affected($$update public.players set school = 'Hacked' where id = 'f4000000-0000-0000-0000-000000000005'$$), 0, 'coach cannot modify another coach''s player');

select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, coach_id) values ('created-by-c1', '900000414', '2015-05-05', '39000001', 'f0000000-0000-0000-0000-0000000000c2')$$, 'coach can create a player');
select throws_ok($$update public.players set coach_id = 'f0000000-0000-0000-0000-0000000000c2' where id = 'f4000000-0000-0000-0000-000000000006'$$, '42501', 'ajyal:only_admin_can_reassign', 'coach cannot hand a player to another coach');

select lives_ok($$select public.remove_player('f4000000-0000-0000-0000-000000000007')$$, 'coach removes their own player');
select is((select count(*)::int from public.players where full_name = 'to-remove'), 0, 'a removed player disappears for its coach');
select throws_ok($$select public.remove_player('f4000000-0000-0000-0000-000000000008')$$, 'P0002', 'ajyal:player_not_found', 'coach cannot remove another coach''s player');
select lives_ok($$select public.remove_player('f4000000-0000-0000-0000-000000000009')$$, 'first removal succeeds');
select throws_ok($$select public.remove_player('f4000000-0000-0000-0000-000000000009')$$, 'P0002', 'ajyal:player_not_found', 'a player cannot be removed twice');
select throws_like($$update public.players set deleted_at = now() where id = 'f4000000-0000-0000-0000-000000000010'$$, '%row-level security%', 'removal by editing deleted_at is blocked (remove_player only)');

select lives_ok($$select public.remove_player('f4000000-0000-0000-0000-000000000011')$$, 'coach removes a player to restore later');
select lives_ok($$update public.players set deleted_at = null where id = 'f4000000-0000-0000-0000-000000000011'$$, 'coach restoring is a silent no-op (the row is invisible to them)');
select tests.reset();

select is((select coach_id from public.players where full_name = 'created-by-c1'), 'f0000000-0000-0000-0000-0000000000c1'::uuid, 'coach owns what they create even if they named another coach');
select is((select created_by from public.players where full_name = 'created-by-c1'), 'f0000000-0000-0000-0000-0000000000c1'::uuid, 'created_by records the coach');
select is((select school from public.players where id = 'f4000000-0000-0000-0000-000000000005'), null, 'the foreign player was left untouched');
select is((select deleted_by from public.players where id = 'f4000000-0000-0000-0000-000000000007'), 'f0000000-0000-0000-0000-0000000000c1'::uuid, 'removal records who did it');
select ok((select deleted_at is not null from public.players where id = 'f4000000-0000-0000-0000-000000000007'), 'the removed player stays in the database (soft delete)');
select ok((select deleted_at is not null from public.players where id = 'f4000000-0000-0000-0000-000000000011'), 'a coach could not restore the removed player');

select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.players where full_name = 'to-remove'), 1, 'admin still sees the removed player');
select lives_ok($$update public.players set deleted_at = null where id = 'f4000000-0000-0000-0000-000000000011'$$, 'admin can restore a removed player');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.players where full_name = 'restore-me'), 1, 'the restored player is back for its coach');
select tests.reset();
select is((select deleted_by from public.players where id = 'f4000000-0000-0000-0000-000000000011'), null, 'restoring clears deleted_by');

-- ---------------------------------------------------------------------------
-- writes by an admin
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select lives_ok($$update public.players set coach_id = 'f0000000-0000-0000-0000-0000000000c2' where id = 'f4000000-0000-0000-0000-000000000012'$$, 'admin reassigns a player');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.players where full_name = 'admin-moves-me'), 0, 'the former coach no longer sees the player');
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.players where full_name = 'admin-moves-me'), 1, 'the new coach sees the player');
select tests.reset();
select is(
  (select (summary ->> 'from_coach_name') || ' > ' || (summary ->> 'to_coach_name') || ' by ' || (summary ->> 'actor_name')
     from public.activity_log
    where entity_id = 'f4000000-0000-0000-0000-000000000012' and action = 'player.reassigned' and actor_id = 'f0000000-0000-0000-0000-0000000000a1'),
  'Coach One > Coach Two by Admin A',
  'reassignment is logged with both coach names and the admin as actor'
);

-- ---------------------------------------------------------------------------
-- data rules
-- ---------------------------------------------------------------------------
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '12345678', '2015-01-01', '39000000')$$, '23514', null, 'CPR with 8 digits is rejected');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '1234567890', '2015-01-01', '39000000')$$, '23514', null, 'CPR with 10 digits is rejected');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '12345678a', '2015-01-01', '39000000')$$, '23514', null, 'CPR with a letter is rejected');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '', '2015-01-01', '39000000')$$, '23514', null, 'empty CPR is rejected');

select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '900000501', '2015-01-01', '39000000')$$, 'a valid CPR is accepted');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '900000501', '2015-01-01', '39000000')$$, '23505', null, 'CPR is unique among active players');
update public.players set deleted_at = now() where cpr = '900000501';
select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '900000501', '2015-01-01', '39000000')$$, 'removing a player frees their CPR');

select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, has_disease) values ('rule-test', '900000502', '2015-01-01', '39000000', true)$$, '23514', null, 'a condition needs a description');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, has_disease, disease_description) values ('rule-test', '900000503', '2015-01-01', '39000000', true, '   ')$$, '23514', null, 'a blank description does not count');
select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, has_disease, disease_description) values ('rule-test', '900000504', '2015-01-01', '39000000', false, 'stray text')$$, '23514', null, 'no condition means no description');
select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone, has_disease, disease_description) values ('rule-test', '900000505', '2015-01-01', '39000000', true, 'Asthma')$$, 'a condition with a description is accepted');

select throws_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('rule-test', '900000506', '2999-01-01', '39000000')$$, '23514', 'ajyal:dob_in_future', 'a date of birth in the future is rejected');

-- ---------------------------------------------------------------------------
-- activity logging
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select lives_ok($$insert into public.players (full_name, cpr, date_of_birth, phone) values ('log-me', '900000601', '2015-05-05', '39000001')$$, 'coach creates a player to be logged');
select lives_ok($$select public.remove_player((select id from public.players where full_name = 'log-me'))$$, 'and removes it');
select lives_ok($$update public.players set school = 'New School' where id = 'f4000000-0000-0000-0000-000000000013'$$, 'coach edits a player');
select lives_ok($$update public.players set school = 'New School' where id = 'f4000000-0000-0000-0000-000000000013'$$, 'and saves the same values again');
select tests.reset();

select is((select array_agg(action order by action) from public.activity_log where entity_id = (select id from public.players where full_name = 'log-me')), array['player.created', 'player.removed'], 'creation and removal are both logged');
select is((select count(*)::int from public.activity_log where entity_id = (select id from public.players where full_name = 'log-me') and (actor_id is distinct from 'f0000000-0000-0000-0000-0000000000c1' or summary ->> 'actor_name' <> 'Coach One' or summary ->> 'player_name' <> 'log-me')), 0, 'every row carries the actor and a display snapshot');
select is((select summary ->> 'coach_name' from public.activity_log where entity_id = (select id from public.players where full_name = 'log-me') and action = 'player.created'), 'Coach One', 'creation records the owning coach');
select is((select count(*)::int from public.activity_log where entity_id = 'f4000000-0000-0000-0000-000000000013' and action = 'player.updated'), 1, 'an update is logged only when something actually changed');

select * from finish();
rollback;
