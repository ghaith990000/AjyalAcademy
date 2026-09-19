-- Ajyal Academy — training sessions and attendance. Contract: docs/04-data-model.md, docs/05-business-rules.md
--
-- Sessions are written by clients with plain table access (RLS: an admin any coach's, a coach their own); this
-- migration adds the guard trigger for the rules RLS cannot express. Attendance has no client write access:
-- `save_attendance` is one function = one transaction (SECURITY DEFINER, so it does its own permission checks).
-- Errors use the message format 'ajyal:<code>'.

-- ---------------------------------------------------------------------------
-- training_sessions guard
--   * insert: `created_by` is the caller; a session cannot be created already cancelled
--   * the session's coach must be an active coach (admins hold no roster — see assign_players)
--   * cancelling stamps the server time (the client's value is ignored) and is final: a cancelled session is
--     read-only and cannot be revived
--   * moving a session that already has attendance to another coach would orphan it, so it is refused
-- ---------------------------------------------------------------------------
create function public.trg_sessions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.cancelled_at := null;
  else
    if old.cancelled_at is not null then
      raise exception 'ajyal:session_cancelled' using errcode = '55000';
    end if;
    new.created_by := old.created_by;
    if new.cancelled_at is not null then
      new.cancelled_at := now();
    end if;
  end if;

  if tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id then
    if not exists (
      select 1 from public.profiles where id = new.coach_id and role = 'coach' and active
    ) then
      raise exception 'ajyal:invalid_coach' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.coach_id is distinct from old.coach_id
     and exists (select 1 from public.attendance where session_id = old.id) then
    raise exception 'ajyal:session_has_attendance' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger sessions_guard before insert or update on public.training_sessions
  for each row execute function public.trg_sessions_guard();

-- ---------------------------------------------------------------------------
-- save_attendance
--   p_records: [{ "player_id": uuid, "status": "present" | "absent" }, …] — each player at most once, and every
--   player on the session's roster (the session coach's players, not removed). Records are upserted, so saving
--   again corrects earlier marks; players not mentioned keep whatever was saved. Rows whose status did not change
--   keep their original `marked_by` / `marked_at`. Logs one `attendance.saved`.
-- ---------------------------------------------------------------------------
create function public.save_attendance(p_session_id uuid, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.training_sessions;
  v_total integer;
  v_distinct integer;
  v_missing integer;
  v_present integer;
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;
  if not public.can_view_session(p_session_id) then
    raise exception 'ajyal:session_not_found' using errcode = 'P0002';
  end if;

  -- Serialises with cancelling / editing the same session.
  select * into v_session from public.training_sessions where id = p_session_id for update;
  if v_session.cancelled_at is not null then
    raise exception 'ajyal:session_cancelled' using errcode = '55000';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end if;

  begin
    select
      count(*)::integer,
      count(distinct r.player_id)::integer,
      (count(*) filter (where r.player_id is null or r.status is null))::integer,
      (count(*) filter (where r.status = 'present'))::integer
    into v_total, v_distinct, v_missing, v_present
    from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status);
  exception when others then
    -- not objects, a malformed uuid or an unknown status
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end;
  if v_missing > 0 or v_total <> v_distinct then
    raise exception 'ajyal:invalid_records' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status)
    where not exists (
      select 1 from public.players p
      where p.id = r.player_id and p.coach_id = v_session.coach_id and p.deleted_at is null
    )
  ) then
    raise exception 'ajyal:not_on_roster' using errcode = '22023';
  end if;

  insert into public.attendance (session_id, player_id, status, marked_by, marked_at)
  select p_session_id, r.player_id, r.status, auth.uid(), now()
  from jsonb_to_recordset(p_records) as r (player_id uuid, status public.attendance_status)
  on conflict (session_id, player_id) do update
    set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at
    where public.attendance.status is distinct from excluded.status;

  perform public.log_activity(
    'attendance.saved', 'attendance', p_session_id,
    jsonb_build_object(
      'session_date', v_session.session_date,
      'start_time', v_session.start_time,
      'coach_name', (select full_name from public.profiles where id = v_session.coach_id),
      'present_count', v_present,
      'total_count', v_total
    )
  );
end;
$$;

revoke all on function public.save_attendance(uuid, jsonb) from public, anon;
grant execute on function public.save_attendance(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Read model for a player's attendance history and rate. security_invoker: the caller's RLS applies (a coach
-- sees marks from sessions they run). Cancelled sessions are left out — they did not happen.
-- ---------------------------------------------------------------------------
create view public.player_attendance with (security_invoker = true) as
select
  a.player_id,
  a.session_id,
  a.status,
  a.marked_at,
  s.session_date,
  s.start_time,
  s.end_time,
  s.location,
  s.coach_id
from public.attendance a
join public.training_sessions s on s.id = a.session_id
where s.cancelled_at is null;

grant select on public.player_attendance to authenticated;
