-- Ajyal Academy — Phase 11: CPR documents and player photos.
--
-- A private Storage bucket, `player-files` (never public — an image or PDF of a child's ID is not a public
-- asset). Three ways in:
--
--   * a parent, on the public form, may attach one CPR file per child before sending it — anon can only
--     INSERT under `applications/…`, and can never read anything back (matches Phase 10's write-only door);
--   * an admin (any player) or a coach (their own player) can add or replace a photo and/or CPR file from the
--     player page — plain `storage.objects` INSERT/DELETE under `players/<id>/…`;
--   * reading a file (a signed URL, a few minutes) is admin-any or coach-own, decided the same way `players`
--     itself is: an admin always, a coach only when the *player* row they own points at that exact object —
--     so a coach only ever sees a pending application's file once accepting has copied its path onto the
--     player they were given.
--
-- `players.cpr_file_path` / `avatar_path` and `player_applications.cpr_storage_path` hold the object's
-- `name` (bucket `player-files`); nothing is copied when an application is accepted — the player's
-- `cpr_file_path` simply points at the same object the parent uploaded.
--
-- Error codes (`ajyal:<code>`): invalid_file, file_not_found (guard trigger) · invalid_input (submit, an
-- attached path that is not this submission's or does not exist).

-- ---------------------------------------------------------------------------
-- The bucket. Private; the Storage API itself rejects a wrong type or a file over the limit.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-files', 'player-files', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- players: an optional photo and CPR file (whoever may edit the player may set these) — added first, so
-- the storage policies below can reference the columns.
-- ---------------------------------------------------------------------------
alter table public.players
  add column cpr_file_path text check (cpr_file_path is null or length(cpr_file_path) <= 300),
  add column avatar_path text check (avatar_path is null or length(avatar_path) <= 300);

-- Admin-or-owning-coach for a `players/<id>/…` object; used by the objects policies below.
create function public.owns_player_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.players p
    where p.deleted_at is null
      and p.coach_id = auth.uid()
      and p.id::text = (regexp_match(p_name, '^players/([0-9a-f-]{36})/'))[1]
  )
$$;

revoke all on function public.owns_player_file(text) from public, anon;
grant execute on function public.owns_player_file(text) to authenticated;

-- storage.objects already carries Supabase's own project-wide grants for anon/authenticated (unlike the
-- public schema, D-036 does not apply here); RLS is the only gate, and with no policy the default is "no
-- rows" — exactly like every other table in this app.
create policy player_files_insert_anon on storage.objects for insert to anon
  with check (bucket_id = 'player-files' and name ~ '^applications/');

create policy player_files_insert_auth on storage.objects for insert to authenticated
  with check (
    bucket_id = 'player-files' and name ~ '^players/' and public.owns_player_file(name)
  );

create policy player_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'player-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.players p
        where p.coach_id = auth.uid()
          and p.deleted_at is null
          and (p.cpr_file_path = storage.objects.name or p.avatar_path = storage.objects.name)
      )
    )
  );

-- Only a `players/…` object can be deleted (replacing a photo/CPR file) — an application's own upload is
-- part of its permanent record and is never removed, the same as the request row itself.
create policy player_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'player-files' and name ~ '^players/' and public.owns_player_file(name)
  );

create or replace function public.trg_players_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  constrained boolean := auth.uid() is not null and not public.is_admin();
begin
  if new.date_of_birth >= current_date then
    raise exception 'ajyal:dob_in_future' using errcode = '23514';
  end if;

  if new.location_id is not null and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    if not exists (select 1 from public.locations where id = new.location_id and active) then
      raise exception 'ajyal:invalid_location' using errcode = '23514';
    end if;
  end if;

  -- A CPR file may be the parent's own upload (kept as-is when an application is accepted) or one added
  -- straight onto the player; a photo is always added straight onto the player.
  if new.cpr_file_path is not null and (tg_op = 'INSERT' or new.cpr_file_path is distinct from old.cpr_file_path) then
    if new.cpr_file_path !~ ('^(players/' || new.id::text || '/|applications/)') then
      raise exception 'ajyal:invalid_file' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'player-files' and name = new.cpr_file_path) then
      raise exception 'ajyal:file_not_found' using errcode = 'P0002';
    end if;
  end if;

  if new.avatar_path is not null and (tg_op = 'INSERT' or new.avatar_path is distinct from old.avatar_path) then
    if new.avatar_path !~ ('^players/' || new.id::text || '/') then
      raise exception 'ajyal:invalid_file' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'player-files' and name = new.avatar_path) then
      raise exception 'ajyal:file_not_found' using errcode = 'P0002';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if constrained then
      new.coach_id := auth.uid();
    end if;
    new.deleted_at := null;
    new.deleted_by := null;
  else
    if constrained then
      if new.coach_id is distinct from old.coach_id then
        raise exception 'ajyal:only_admin_can_reassign' using errcode = '42501';
      end if;
      if old.deleted_at is not null and new.deleted_at is null then
        raise exception 'ajyal:only_admin_can_restore' using errcode = '42501';
      end if;
      new.created_by := old.created_by;
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_by := auth.uid();
    elsif new.deleted_at is null then
      new.deleted_by := null;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- player_applications: the parent's own CPR upload, one per child
-- ---------------------------------------------------------------------------
alter table public.player_applications
  add column cpr_storage_path text check (cpr_storage_path is null or length(cpr_storage_path) <= 300);

-- The admin list/detail need the new column; the view reads `a.*` in the middle of its column list, so a
-- plain CREATE OR REPLACE cannot absorb the table's new trailing column — it is dropped and recreated.
drop view public.player_application_overview;

create view public.player_application_overview
with (security_invoker = true) as
select
  a.*,
  l.name as location_name,
  d.full_name as decided_by_name,
  ex.id as existing_player_id,
  ex.full_name as existing_player_name,
  case
    when a.status = 'pending' then (
      select count(*)::integer
      from public.player_applications o
      where o.status = 'pending' and o.cpr = a.cpr and o.id <> a.id
    )
    else 0
  end as same_cpr_pending
from public.player_applications a
left join public.locations l on l.id = a.location_id
left join public.profiles d on d.id = a.decided_by
left join lateral (
  select p.id, p.full_name
  from public.players p
  where a.status = 'pending' and p.cpr = a.cpr and p.deleted_at is null
  limit 1
) ex on true;

grant select on public.player_application_overview to authenticated;

-- ---------------------------------------------------------------------------
-- submit_player_applications(): each child may carry `cpr_storage_path`, an object the parent already
-- uploaded to `applications/<this submission>/…`. Everything else about the function is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.submit_player_applications(
  p_submission_id uuid,
  p_guardian_name text,
  p_phone text,
  p_location_id uuid,
  p_language text,
  p_children jsonb,
  p_website text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardian text := trim(coalesce(p_guardian_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_phone_key text;
  v_count integer;
  v_child jsonb;
  v_index smallint := 0;
  v_names text[] := '{}';
  v_location_name text;
  v_file text;
begin
  if coalesce(trim(p_website), '') <> '' then
    return;
  end if;

  if p_submission_id is null
     or v_guardian = '' or length(v_guardian) > 120
     or v_phone !~ '^\+?[0-9]{8,15}$'
     or p_language is null or p_language not in ('ar', 'en')
     or p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'ajyal:invalid_input' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_children);
  if v_count = 0 then
    raise exception 'ajyal:invalid_input' using errcode = '22023';
  elsif v_count > 4 then
    raise exception 'ajyal:too_many_children' using errcode = '22023';
  end if;

  -- A retry of a submission that already went through succeeds without adding it again.
  if exists (select 1 from public.player_applications where submission_id = p_submission_id) then
    return;
  end if;

  if p_location_id is not null then
    select l.name into v_location_name from public.locations l where l.id = p_location_id and l.active;
    if not found then
      raise exception 'ajyal:invalid_location' using errcode = '22023';
    end if;
  end if;

  v_phone_key := right(regexp_replace(v_phone, '\D', '', 'g'), 8);
  if (
       select count(distinct a.submission_id)
       from public.player_applications a
       where a.created_at > now() - interval '1 day'
         and right(regexp_replace(a.phone, '\D', '', 'g'), 8) = v_phone_key
     ) >= 5
     or (select count(distinct a.submission_id) from public.player_applications a where a.created_at > now() - interval '1 hour') >= 60
     or (select count(distinct a.submission_id) from public.player_applications a where a.created_at > now() - interval '1 day') >= 300 then
    raise exception 'ajyal:rate_limited' using errcode = '54000';
  end if;

  for v_child in select c.value from jsonb_array_elements(p_children) as c loop
    v_index := v_index + 1;
    begin
      if (v_child ->> 'date_of_birth')::date >= public.today_bh() then
        raise exception 'ajyal:invalid_input' using errcode = '22023';
      end if;

      -- An attached CPR file must be this submission's own upload, and must actually exist.
      v_file := nullif(trim(v_child ->> 'cpr_storage_path'), '');
      if v_file is not null then
        if v_file !~ ('^applications/' || p_submission_id::text || '/') then
          raise exception 'ajyal:invalid_input' using errcode = '22023';
        end if;
        if not exists (select 1 from storage.objects where bucket_id = 'player-files' and name = v_file) then
          raise exception 'ajyal:invalid_input' using errcode = '22023';
        end if;
      end if;

      insert into public.player_applications (
        submission_id, child_index, guardian_name, phone, language, location_id,
        full_name, cpr, date_of_birth, address, school, has_disease, disease_description, cpr_storage_path
      )
      values (
        p_submission_id, v_index, v_guardian, v_phone, p_language, p_location_id,
        trim(v_child ->> 'full_name'),
        trim(v_child ->> 'cpr'),
        (v_child ->> 'date_of_birth')::date,
        nullif(trim(v_child ->> 'address'), ''),
        nullif(trim(v_child ->> 'school'), ''),
        coalesce((v_child ->> 'has_disease')::boolean, false),
        case
          when coalesce((v_child ->> 'has_disease')::boolean, false)
            then nullif(trim(v_child ->> 'disease_description'), '')
        end,
        v_file
      );
    exception
      when check_violation or not_null_violation or invalid_text_representation
        or invalid_datetime_format or datetime_field_overflow or string_data_right_truncation then
        raise exception 'ajyal:invalid_input' using errcode = '22023';
      when unique_violation then
        -- the same submission arrived twice at once; the other one stored it
        return;
    end;
    v_names := v_names || trim(v_child ->> 'full_name');
  end loop;

  if (
       select count(distinct a.cpr) from public.player_applications a where a.submission_id = p_submission_id
     ) < v_count then
    raise exception 'ajyal:duplicate_child' using errcode = '22023';
  end if;

  perform public.log_activity(
    'application.submitted', 'application', p_submission_id,
    jsonb_build_object(
      'guardian_name', v_guardian,
      'child_count', v_count,
      'child_names', to_jsonb(v_names),
      'location_name', v_location_name
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_player_application(): the player's cpr_file_path starts out as whatever the parent attached —
-- the same storage object, not a copy.
-- ---------------------------------------------------------------------------
create or replace function public.accept_player_application(
  p_application_id uuid,
  p_coach_id uuid,
  p_location_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.player_applications;
  v_existing uuid;
  v_player uuid;
  v_coach_name text;
  v_location_name text;
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;

  select * into a from public.player_applications where id = p_application_id for update;
  if not found then
    raise exception 'ajyal:application_not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'pending' then
    raise exception 'ajyal:already_decided' using errcode = '55000';
  end if;

  select p.id into v_existing from public.players p where p.cpr = a.cpr and p.deleted_at is null;
  if found then
    raise exception 'ajyal:cpr_taken' using errcode = '23505', detail = v_existing::text;
  end if;

  if p_coach_id is not null then
    select pr.full_name into v_coach_name
    from public.profiles pr where pr.id = p_coach_id and pr.role = 'coach' and pr.active;
    if not found then
      raise exception 'ajyal:invalid_coach' using errcode = '22023';
    end if;
  end if;

  if p_location_id is not null then
    select l.name into v_location_name from public.locations l where l.id = p_location_id and l.active;
    if not found then
      raise exception 'ajyal:invalid_location' using errcode = '22023';
    end if;
  end if;

  perform set_config('ajyal.application', 'on', true);
  insert into public.players (
    full_name, cpr, date_of_birth, address, school, phone, has_disease, disease_description,
    guardian_name, coach_id, location_id, cpr_file_path
  )
  values (
    a.full_name, a.cpr, a.date_of_birth, a.address, a.school, a.phone, a.has_disease, a.disease_description,
    a.guardian_name, p_coach_id, p_location_id, a.cpr_storage_path
  )
  returning id into v_player;
  perform set_config('ajyal.application', 'off', true);

  update public.player_applications
  set status = 'accepted', decided_at = now(), decided_by = auth.uid(), player_id = v_player
  where id = a.id;

  perform public.log_activity(
    'application.accepted', 'application', a.id,
    jsonb_build_object(
      'player_name', a.full_name,
      'guardian_name', a.guardian_name,
      'coach_name', v_coach_name,
      'location_name', v_location_name,
      'player_id', v_player
    )
  );

  return v_player;
end;
$$;
