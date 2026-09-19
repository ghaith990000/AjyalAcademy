-- assign_players: admin-only bulk (re)assignment. See 01_access_control.test.sql for how to run.
--   coach3 (f0000000-…-c3) is an INACTIVE coach.
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

grant execute on all functions in schema tests to public;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000a1', 'admin@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c1', 'coach1@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c2', 'coach2@tests.invalid'),
  ('f0000000-0000-0000-0000-0000000000c3', 'coach3@tests.invalid');
insert into public.profiles (id, full_name, email, role, active) values
  ('f0000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin@tests.invalid', 'admin', true),
  ('f0000000-0000-0000-0000-0000000000c1', 'Coach One', 'coach1@tests.invalid', 'coach', true),
  ('f0000000-0000-0000-0000-0000000000c2', 'Coach Two', 'coach2@tests.invalid', 'coach', true),
  ('f0000000-0000-0000-0000-0000000000c3', 'Coach Three', 'coach3@tests.invalid', 'coach', false);

-- p1, p2: coach 1 · p3: unassigned · p4: coach 1 but removed · p5: coach 1, never in a batch
-- (the players_guard trigger forces deleted_at to null on insert, so p4 is removed by an update)
insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  ('f6000000-0000-0000-0000-000000000001', 'as-p1', '900000701', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f6000000-0000-0000-0000-000000000002', 'as-p2', '900000702', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f6000000-0000-0000-0000-000000000003', 'as-p3', '900000703', '2015-01-01', '39000000', null),
  ('f6000000-0000-0000-0000-000000000004', 'as-p4', '900000704', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1'),
  ('f6000000-0000-0000-0000-000000000005', 'as-p5', '900000705', '2015-01-01', '39000000', 'f0000000-0000-0000-0000-0000000000c1');
update public.players set deleted_at = now() where id = 'f6000000-0000-0000-0000-000000000004';
delete from public.activity_log; -- start from an empty feed so counts below are exact (rolled back with the rest)

-- ---------------------------------------------------------------------------
-- who may call it
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.assign_players(array['f6000000-0000-0000-0000-000000000001']::uuid[], 'f0000000-0000-0000-0000-0000000000c1')$$, '42501', 'ajyal:forbidden', 'a coach cannot assign players');
select tests.act_as_anon();
select throws_ok($$select public.assign_players(array['f6000000-0000-0000-0000-000000000001']::uuid[], 'f0000000-0000-0000-0000-0000000000c1')$$, '42501', null, 'anon cannot call assign_players');
select tests.reset();
select is((select coach_id from public.players where id = 'f6000000-0000-0000-0000-000000000001'), 'f0000000-0000-0000-0000-0000000000c1'::uuid, 'the refused calls changed nothing');

-- ---------------------------------------------------------------------------
-- bulk assignment
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is(public.assign_players(array['f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000004']::uuid[], 'f0000000-0000-0000-0000-0000000000c2'), 3, 'assigns the three live players and skips the removed one');
select tests.act_as('f0000000-0000-0000-0000-0000000000c1');
select is((select array_agg(full_name order by full_name) from public.players where full_name like 'as-p%'), array['as-p5'], 'the old coach now sees only the player left with them');
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select is((select array_agg(full_name order by full_name) from public.players where full_name like 'as-p%'), array['as-p1', 'as-p2', 'as-p3'], 'the new coach sees the reassigned players immediately');
select tests.reset();
select is((select coach_id from public.players where id = 'f6000000-0000-0000-0000-000000000004'), 'f0000000-0000-0000-0000-0000000000c1'::uuid, 'a removed player is left untouched');
select is((select count(*)::int from public.activity_log where action = 'player.reassigned' and actor_id = 'f0000000-0000-0000-0000-0000000000a1'), 3, 'one player.reassigned row per changed player, with the admin as actor');
select is((select (summary ->> 'from_coach_name') || ' > ' || (summary ->> 'to_coach_name') from public.activity_log where entity_id = 'f6000000-0000-0000-0000-000000000001' and action = 'player.reassigned'), 'Coach One > Coach Two', 'the log names both coaches');
select is((select summary ->> 'from_coach_name' from public.activity_log where entity_id = 'f6000000-0000-0000-0000-000000000003' and action = 'player.reassigned'), null, 'a previously unassigned player has no "from" coach');

select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is(public.assign_players(array['f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002']::uuid[], 'f0000000-0000-0000-0000-0000000000c2'), 0, 're-running the same batch changes nothing');
select tests.reset();
select is((select count(*)::int from public.activity_log where action = 'player.reassigned'), 3, 'and logs nothing extra');

-- ---------------------------------------------------------------------------
-- unassign (coach argument omitted = null)
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select is(public.assign_players(array['f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002']::uuid[]), 2, 'omitting the coach unassigns');
select tests.reset();
select is((select count(*)::int from public.players where id in ('f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002') and coach_id is null), 2, 'the players are now unassigned');
select tests.act_as('f0000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.players where id in ('f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002')), 0, 'and no coach can see them');
select tests.reset();

-- ---------------------------------------------------------------------------
-- validation
-- ---------------------------------------------------------------------------
select tests.act_as('f0000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.assign_players(array['f6000000-0000-0000-0000-000000000001']::uuid[], 'f0000000-0000-0000-0000-0000000000a1')$$, '22023', 'ajyal:invalid_coach', 'an admin cannot be the target (only coaches)');
select throws_ok($$select public.assign_players(array['f6000000-0000-0000-0000-000000000001']::uuid[], 'f0000000-0000-0000-0000-0000000000c3')$$, '22023', 'ajyal:invalid_coach', 'an inactive coach cannot be the target');
select throws_ok($$select public.assign_players(array['f6000000-0000-0000-0000-000000000001']::uuid[], 'f0000000-0000-0000-0000-00000000dead')$$, '22023', 'ajyal:invalid_coach', 'an unknown coach is rejected');
select is(public.assign_players(array[]::uuid[], 'f0000000-0000-0000-0000-0000000000c2'), 0, 'an empty batch is a no-op');
select is(public.assign_players(null, 'f0000000-0000-0000-0000-0000000000c2'), 0, 'a null batch is a no-op');
select throws_ok($$select public.assign_players(array(select gen_random_uuid() from generate_series(1, 501)), 'f0000000-0000-0000-0000-0000000000c2')$$, '22023', 'ajyal:too_many_players', 'a batch over 500 is refused');
select tests.reset();
select is((select count(*)::int from public.players where id = 'f6000000-0000-0000-0000-000000000001' and coach_id is null), 1, 'rejected calls changed nothing');

select * from finish();
rollback;
