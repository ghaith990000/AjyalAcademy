-- Ajyal Academy — Phase 10: public player registration.
--
-- Parents register their children on a public page (no login). The page can only call two functions as
-- `anon`; it has no table access at all and reads nothing back. An admin then accepts (which creates the
-- player) or rejects each child on its own.
--
--   players.guardian_name            the parent's name, kept when an application is accepted
--   player_applications              one row per child; admins read, nobody writes directly
--   player_application_overview      the admin list: + location, decider, CPR / duplicate warnings
--   public_locations()               anon + signed-in: the active locations for the form's picker
--   submit_player_applications(...)  anon + signed-in: 1–4 children, honeypot, rate limits, idempotent retry
--   accept_player_application(...)   admin: creates the player, marks the application accepted
--   reject_player_application(...)   admin: marks it rejected with an optional internal note
--
-- Error codes (`ajyal:<code>`): invalid_input, too_many_children, duplicate_child, invalid_location,
-- rate_limited (submit) · forbidden, application_not_found, already_decided, cpr_taken, invalid_coach,
-- invalid_location (decide).

-- ---------------------------------------------------------------------------
-- players: the guardian's name
-- ---------------------------------------------------------------------------
alter table public.players
  add column guardian_name text
  check (guardian_name is null or length(trim(guardian_name)) between 1 and 120);

-- ---------------------------------------------------------------------------
-- player_applications
-- ---------------------------------------------------------------------------
create type public.application_status as enum ('pending', 'accepted', 'rejected');

create table public.player_applications (
  id uuid primary key default gen_random_uuid(),
  -- One submission = one parent, 1–4 children. The browser makes the id, so a retry after a dropped
  -- connection is recognised and not stored twice.
  submission_id uuid not null,
  child_index smallint not null check (child_index between 1 and 4),
  guardian_name text not null check (length(trim(guardian_name)) between 1 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{8,15}$'),
  -- The language the parent used, so the admin's WhatsApp message can be in it.
  language text not null check (language in ('ar', 'en')),
  location_id uuid references public.locations (id),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  cpr text not null check (cpr ~ '^[0-9]{9}$'),
  date_of_birth date not null check (date_of_birth >= date '1990-01-01'),
  address text check (length(address) <= 200),
  school text check (length(school) <= 120),
  has_disease boolean not null default false,
  disease_description text check (length(disease_description) <= 500),
  status public.application_status not null default 'pending',
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text check (length(decision_note) <= 500),
  player_id uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (submission_id, child_index),
  constraint player_applications_disease_description_required check (
    (has_disease and length(trim(coalesce(disease_description, ''))) > 0)
    or (not has_disease and disease_description is null)
  ),
  constraint player_applications_decision_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null and player_id is null)
    or (status = 'accepted' and decided_at is not null)
    or (status = 'rejected' and decided_at is not null and player_id is null)
  )
);

create index player_applications_status_idx on public.player_applications (status, created_at desc);
create index player_applications_cpr_idx on public.player_applications (cpr) where status = 'pending';
create index player_applications_created_idx on public.player_applications (created_at);
create index player_applications_location_idx on public.player_applications (location_id) where location_id is not null;

alter table public.player_applications enable row level security;

-- Admins read; nothing writes through the API (the functions below are the only way in).
create policy player_applications_select on public.player_applications for select to authenticated
  using (public.is_admin());
grant select on public.player_applications to authenticated;

-- The admin list. `security_invoker`: RLS applies as the caller, so a coach gets no rows. It reads `a.*`, so a
-- new column on the table needs the view recreated. `existing_player_*` and `same_cpr_pending` warn about a CPR
-- that is already a player or already waiting in another application (only while the application is pending).
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
-- The feed: accepting a player writes one `application.accepted` entry, so the player's own
-- `player.created` entry is skipped for that insert (the accept function sets ajyal.application).
-- ---------------------------------------------------------------------------
create or replace function public.trg_players_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_name text;
  v_from_name text;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('ajyal.application', true), '') = 'on' then
      return null;
    end if;
    select full_name into v_coach_name from public.profiles where id = new.coach_id;
    perform public.log_activity(
      'player.created', 'player', new.id,
      jsonb_build_object('player_name', new.full_name, 'coach_name', v_coach_name)
    );
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform public.log_activity(
      'player.removed', 'player', new.id,
      jsonb_build_object('player_name', new.full_name)
    );
  elsif new.coach_id is distinct from old.coach_id then
    select full_name into v_from_name from public.profiles where id = old.coach_id;
    select full_name into v_coach_name from public.profiles where id = new.coach_id;
    perform public.log_activity(
      'player.reassigned', 'player', new.id,
      jsonb_build_object(
        'player_name', new.full_name,
        'from_coach_name', v_from_name,
        'to_coach_name', v_coach_name
      )
    );
  elsif (to_jsonb(new) - 'deleted_by') is distinct from (to_jsonb(old) - 'deleted_by') then
    perform public.log_activity(
      'player.updated', 'player', new.id,
      jsonb_build_object('player_name', new.full_name)
    );
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- public_locations(): what the form's location picker shows
-- ---------------------------------------------------------------------------
create function public.public_locations()
returns table (id uuid, name text, address text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.name, l.address from public.locations l where l.active order by l.name, l.id
$$;

revoke all on function public.public_locations() from public;
grant execute on function public.public_locations() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_player_applications(): the public door
--
-- p_children = [{ full_name, cpr, date_of_birth, address?, school?, has_disease?, disease_description? }, …]
-- (1–4). Returns nothing: the caller learns only that it worked or why its input is not acceptable — never
-- whether a CPR or a phone number is already known. p_website is a honeypot: a person never sees the field,
-- a bot fills it, and it gets the same "success" without anything being stored.
--
-- Limits (D-090): 5 submissions per phone number per day (compared on the last 8 digits, so +973 and spaces
-- do not dodge it), 60 per hour and 300 per day for everyone.
-- ---------------------------------------------------------------------------
create function public.submit_player_applications(
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
      insert into public.player_applications (
        submission_id, child_index, guardian_name, phone, language, location_id,
        full_name, cpr, date_of_birth, address, school, has_disease, disease_description
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
        end
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

revoke all on function public.submit_player_applications(uuid, text, text, uuid, text, jsonb, text) from public;
grant execute on function public.submit_player_applications(uuid, text, text, uuid, text, jsonb, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_player_application(id, coach, location): creates the player
--
-- The dialog sends exactly what the admin chose: a coach (or none) and a location (or none); it starts with
-- the application's own location. A decided application cannot be decided again; a CPR that is already a
-- player is refused with that player's id in DETAIL.
-- ---------------------------------------------------------------------------
create function public.accept_player_application(
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
    guardian_name, coach_id, location_id
  )
  values (
    a.full_name, a.cpr, a.date_of_birth, a.address, a.school, a.phone, a.has_disease, a.disease_description,
    a.guardian_name, p_coach_id, p_location_id
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

revoke all on function public.accept_player_application(uuid, uuid, uuid) from public, anon;
grant execute on function public.accept_player_application(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_player_application(id, note)
-- ---------------------------------------------------------------------------
create function public.reject_player_application(p_application_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.player_applications;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if length(v_note) > 500 then
    raise exception 'ajyal:invalid_input' using errcode = '22023';
  end if;

  select * into a from public.player_applications where id = p_application_id for update;
  if not found then
    raise exception 'ajyal:application_not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'pending' then
    raise exception 'ajyal:already_decided' using errcode = '55000';
  end if;

  update public.player_applications
  set status = 'rejected', decided_at = now(), decided_by = auth.uid(), decision_note = v_note
  where id = a.id;

  perform public.log_activity(
    'application.rejected', 'application', a.id,
    jsonb_build_object('player_name', a.full_name, 'guardian_name', a.guardian_name)
  );
end;
$$;

revoke all on function public.reject_player_application(uuid, text) from public, anon;
grant execute on function public.reject_player_application(uuid, text) to authenticated;
