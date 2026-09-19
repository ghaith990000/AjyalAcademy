-- Ajyal Academy — player functions.
--
-- Why removal is a function: a plain `UPDATE players SET deleted_at = now()` by a coach fails, because
-- Postgres also checks the SELECT policy against the updated row and removed players are (deliberately)
-- invisible to coaches. So the removal runs as SECURITY DEFINER and verifies ownership itself.
-- The players_guard trigger still stamps deleted_by, and the activity trigger still logs 'player.removed'
-- (both read the caller from auth.uid(), which is the JWT, not the function owner).

create function public.remove_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;

  update public.players
  set deleted_at = now()
  where id = p_player_id
    and deleted_at is null
    and (public.is_admin() or coach_id = auth.uid());

  if not found then
    raise exception 'ajyal:player_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.remove_player(uuid) from public, anon;
grant execute on function public.remove_player(uuid) to authenticated;
