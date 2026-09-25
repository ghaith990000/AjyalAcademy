-- CPR documents & player photos (Phase 11): the private `player-files` bucket and its storage.objects RLS,
-- the players guard trigger's file checks, and the parent's optional CPR upload on submit/accept.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = fb000000-…-n.
--   users: admin u(1), coach1 u(2), coach2 u(3)
--   players: u(11) belongs to coach1, u(12) belongs to coach2
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('fb000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
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
  (tests.u(1), 'pu-admin@tests.invalid'), (tests.u(2), 'pu-coach1@tests.invalid'), (tests.u(3), 'pu-coach2@tests.invalid');
insert into public.profiles (id, full_name, email, role, active) values
  (tests.u(1), 'Admin A', 'pu-admin@tests.invalid', 'admin', true),
  (tests.u(2), 'Coach One', 'pu-coach1@tests.invalid', 'coach', true),
  (tests.u(3), 'Coach Two', 'pu-coach2@tests.invalid', 'coach', true);

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  (tests.u(11), 'pu-P1', '960000011', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(12), 'pu-P2', '960000012', '2015-01-01', '39000000', tests.u(3));

-- ---------------------------------------------------------------------------
-- the bucket
-- ---------------------------------------------------------------------------
select is((select public from storage.buckets where id = 'player-files'), false, 'the bucket is private');
select is((select file_size_limit from storage.buckets where id = 'player-files'), 8388608::bigint, 'an 8 MB limit');
select is((select allowed_mime_types from storage.buckets where id = 'player-files'), array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'only images and PDFs');

-- ---------------------------------------------------------------------------
-- storage RLS: anon may only INSERT under applications/…, and can never read anything back
-- ---------------------------------------------------------------------------
-- Supabase blocks every plain SQL DELETE on storage.objects, whoever runs it ("Direct deletion from storage
-- tables is not allowed. Use the Storage API instead.") — so the delete policy below is exercised by the
-- e2e mock and the owner's live check, not here; what pgTAP can check is that it exists (privilege audit,
-- bottom of this file) and that reading follows the same rule as everywhere else in the app.
select tests.act_as_anon();
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'applications/' || tests.u(901)::text || '/1-app.jpg')$$, 'anon can upload under its own submission');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(11)::text || '/sneaky.jpg')$$, '42501', null, 'anon cannot upload under players/…');
select is_empty($$select * from storage.objects where bucket_id = 'player-files'$$, 'anon reads back nothing — the table grant is Supabase''s own default, RLS just returns no rows rather than an error');
select tests.reset();

-- an admin can see the parent's upload while the request is still pending; a coach cannot
select tests.act_as(tests.u(1));
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'applications/' || tests.u(901)::text || '/1-app.jpg'), 1, 'an admin can see any application''s file');
select tests.reset();
select tests.act_as(tests.u(2));
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'applications/' || tests.u(901)::text || '/1-app.jpg'), 0, 'a coach cannot see a pending application''s file');
select tests.reset();

-- ---------------------------------------------------------------------------
-- storage RLS: an admin (any player) or a coach (their own) may add/replace under players/<id>/…
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(11)::text || '/cpr-a.jpg')$$, 'coach1 can upload a CPR file for their own player');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(12)::text || '/cpr-b.jpg')$$, '42501', null, 'coach1 cannot upload for coach2''s player');
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'players/' || tests.u(11)::text || '/cpr-a.jpg'), 0, 'not even the uploader can read it back before a player row points at it');
select tests.reset();

select tests.act_as(tests.u(3));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(12)::text || '/avatar-a.jpg')$$, 'coach2 can upload a photo for their own player');
select tests.reset();

select tests.act_as(tests.u(1));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(12)::text || '/cpr-c.jpg')$$, 'an admin can upload for any player');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(12)::text || '/other.jpg')$$, 'and a second file for the same player');
select tests.reset();

-- once the player row points at it, its owning coach can see it — never the other coach
select tests.act_as(tests.u(1));
select lives_ok($$update public.players set cpr_file_path = 'players/' || tests.u(11)::text || '/cpr-a.jpg' where id = tests.u(11)$$, 'the CPR file is attached to the player');
select tests.reset();
select tests.act_as(tests.u(2));
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'players/' || tests.u(11)::text || '/cpr-a.jpg'), 1, 'coach1 can now see their own player''s CPR file');
select tests.reset();
select tests.act_as(tests.u(3));
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'players/' || tests.u(11)::text || '/cpr-a.jpg'), 0, 'coach2 still cannot');
select tests.reset();

-- ---------------------------------------------------------------------------
-- the players guard trigger: cpr_file_path / avatar_path must be this player's own upload, or applications/…
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'players/' || tests.u(11)::text || '/cpr-new.jpg')$$, 'coach1 uploads a fresh CPR file');
select tests.reset();

select tests.act_as(tests.u(1));
select lives_ok($$update public.players set cpr_file_path = 'players/' || tests.u(11)::text || '/cpr-new.jpg' where id = tests.u(11)$$, 'a path under the player''s own folder that exists is accepted');
select throws_ok($$update public.players set cpr_file_path = 'players/' || tests.u(12)::text || '/other.jpg' where id = tests.u(11)$$, '22023', 'ajyal:invalid_file', 'a path under another player''s folder is refused');
select throws_ok($$update public.players set cpr_file_path = 'not-a-real-path.jpg' where id = tests.u(11)$$, '22023', 'ajyal:invalid_file', 'a path outside players/ or applications/ is refused');
select throws_ok($$update public.players set cpr_file_path = 'players/' || tests.u(11)::text || '/never-uploaded.jpg' where id = tests.u(11)$$, 'P0002', 'ajyal:file_not_found', 'a path that was never uploaded is refused');
select throws_ok($$update public.players set avatar_path = 'players/' || tests.u(12)::text || '/other.jpg' where id = tests.u(11)$$, '22023', 'ajyal:invalid_file', 'an avatar must be this player''s own folder too');
select lives_ok($$update public.players set cpr_file_path = null, avatar_path = null where id = tests.u(11)$$, 'clearing both is always fine');
select tests.reset();

-- ---------------------------------------------------------------------------
-- submit_player_applications(): an attached CPR file must be this submission's own upload, and must exist
-- ---------------------------------------------------------------------------
select tests.act_as_anon();
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'applications/' || tests.u(902)::text || '/1-ok.jpg')$$, 'a parent uploads their child''s CPR file first');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-files', 'applications/' || tests.u(903)::text || '/1-other.jpg')$$, 'and a second parent uploads their own');

select lives_ok($$select public.submit_player_applications(tests.u(902), 'pu-Parent', '39006001', null, 'en',
  jsonb_build_array(jsonb_build_object('full_name', 'pu-Kid', 'cpr', '960000021', 'date_of_birth', '2015-01-01', 'cpr_storage_path', 'applications/' || tests.u(902)::text || '/1-ok.jpg')))$$,
  'a submission with its own uploaded file is accepted');
select throws_ok($$select public.submit_player_applications(tests.u(904), 'pu-Parent', '39006002', null, 'en',
  jsonb_build_array(jsonb_build_object('full_name', 'pu-Kid', 'cpr', '960000022', 'date_of_birth', '2015-01-01', 'cpr_storage_path', 'applications/' || tests.u(903)::text || '/1-other.jpg')))$$,
  '22023', 'ajyal:invalid_input', 'a file uploaded under a different submission is refused');
select throws_ok($$select public.submit_player_applications(tests.u(905), 'pu-Parent', '39006003', null, 'en',
  jsonb_build_array(jsonb_build_object('full_name', 'pu-Kid', 'cpr', '960000023', 'date_of_birth', '2015-01-01', 'cpr_storage_path', 'applications/' || tests.u(905)::text || '/never-uploaded.jpg')))$$,
  '22023', 'ajyal:invalid_input', 'a file that was never uploaded is refused');
select lives_ok($$select public.submit_player_applications(tests.u(906), 'pu-Parent', '39006004', null, 'en',
  jsonb_build_array(jsonb_build_object('full_name', 'pu-NoFile', 'cpr', '960000024', 'date_of_birth', '2015-01-01')))$$,
  'a submission with no file at all is still fine — it is optional');
select tests.reset();

select is((select cpr_storage_path from public.player_applications where submission_id = tests.u(902)), 'applications/' || tests.u(902)::text || '/1-ok.jpg', 'the file path is stored on the request');
select is((select count(*)::int from public.player_applications where submission_id in (tests.u(904), tests.u(905))), 0, 'a refused submission stores nothing');
select is((select cpr_storage_path from public.player_applications where submission_id = tests.u(906)), null, 'no file is simply null');

-- ---------------------------------------------------------------------------
-- accept_player_application(): the player inherits the parent's own uploaded file, not a copy
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select lives_ok($$select public.accept_player_application((select id from public.player_applications where submission_id = tests.u(902)), null, null)$$, 'accepting the request with a CPR file attached');
select is((select p.cpr_file_path from public.players p join public.player_applications a on a.player_id = p.id where a.submission_id = tests.u(902)), 'applications/' || tests.u(902)::text || '/1-ok.jpg', 'the new player points at the same object the parent uploaded');
select tests.reset();

-- and the coach it was assigned to can now read that very file, even though it still lives under applications/…
select tests.act_as(tests.u(1));
select lives_ok($$select public.accept_player_application((select id from public.player_applications where submission_id = tests.u(906)), tests.u(2), null)$$, 'a second request, this time assigned to coach1');
select tests.reset();
select tests.act_as(tests.u(2));
select is((select count(*)::int from storage.objects where bucket_id = 'player-files' and name = 'applications/' || tests.u(902)::text || '/1-ok.jpg'), 0, 'coach1 still cannot see a file belonging to another coach''s player');
select tests.reset();

-- ---------------------------------------------------------------------------
-- privilege audit
-- ---------------------------------------------------------------------------
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), array['public_locations', 'submit_player_applications'], 'owns_player_file does not widen what anon can call');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'player_files_%'), 4, 'exactly four storage policies for this bucket (insert × 2, select, delete)');

select * from finish();
rollback;
