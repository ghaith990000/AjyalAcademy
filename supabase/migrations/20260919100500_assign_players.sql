-- Ajyal Academy — bulk (re)assignment of players to a coach. Contract: docs/04-data-model.md#rpcs
--
-- One UPDATE for the whole batch (single transaction). The existing players_activity trigger logs a
-- `player.reassigned` row per player whose coach actually changed, with the acting admin as actor
-- (auth.uid() comes from the JWT, not the function owner). Players already on the target coach are
-- skipped, so re-running a batch logs nothing. Removed players are never touched.
--
-- p_coach_id NULL = unassign. Returns how many players changed.

create function public.assign_players(p_player_ids uuid[], p_coach_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'ajyal:forbidden' using errcode = '42501';
  end if;

  if p_player_ids is null or cardinality(p_player_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_player_ids) > 500 then
    raise exception 'ajyal:too_many_players' using errcode = '22023';
  end if;

  if p_coach_id is not null and not exists (
    select 1 from public.profiles where id = p_coach_id and role = 'coach' and active
  ) then
    raise exception 'ajyal:invalid_coach' using errcode = '22023';
  end if;

  update public.players
  set coach_id = p_coach_id
  where id = any (p_player_ids)
    and deleted_at is null
    and coach_id is distinct from p_coach_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.assign_players(uuid[], uuid) from public, anon;
grant execute on function public.assign_players(uuid[], uuid) to authenticated;
