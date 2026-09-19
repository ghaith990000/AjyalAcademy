-- Ajyal Academy — save_attendance: attendance cannot be taken for a session dated in the future.
--
-- "Future" is judged on the academy's date (today_bh(), D-047): a session later today can be marked, one dated
-- tomorrow or after cannot. Checked right after the cancelled check, before the records are read. Otherwise
-- unchanged (see 20260919100700 and 20260919100800).

create or replace function public.save_attendance(p_session_id uuid, p_records jsonb)
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
  if not found then
    raise exception 'ajyal:session_not_found' using errcode = 'P0002';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'ajyal:session_cancelled' using errcode = '55000';
  end if;
  if v_session.session_date > public.today_bh() then
    raise exception 'ajyal:session_in_future' using errcode = '55000';
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

-- create or replace keeps the grants; restated so this file stands on its own.
revoke all on function public.save_attendance(uuid, jsonb) from public, anon;
grant execute on function public.save_attendance(uuid, jsonb) to authenticated;
