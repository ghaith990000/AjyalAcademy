-- Ajyal Academy — activity log writers. Contract: docs/04-data-model.md#activity_log
--
-- activity_log has no INSERT policy or grant for clients; rows are written only by the
-- SECURITY DEFINER functions below (called from triggers now, and from RPCs in later phases).
-- Each row stores a display snapshot in `summary`, including `actor_name`.

create function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor is not null then
    select full_name into v_actor_name from public.profiles where id = v_actor;
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
  values (
    v_actor,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_summary, '{}'::jsonb) || jsonb_build_object('actor_name', v_actor_name)
  );
end;
$$;

-- Internal only: never callable through the API.
revoke all on function public.log_activity(text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- players: created / removed / reassigned / updated
-- ---------------------------------------------------------------------------
create function public.trg_players_activity()
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

create trigger players_activity after insert or update on public.players
  for each row execute function public.trg_players_activity();

-- ---------------------------------------------------------------------------
-- discounts: created
-- ---------------------------------------------------------------------------
create function public.trg_discounts_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity(
    'discount.created', 'discount', new.id,
    jsonb_build_object(
      'discount_name', new.name,
      'code', new.code,
      'discount_type', new.type,
      'value', new.value
    )
  );
  return null;
end;
$$;

create trigger discounts_activity after insert on public.discounts
  for each row execute function public.trg_discounts_activity();

-- ---------------------------------------------------------------------------
-- training_sessions: created / cancelled
-- ---------------------------------------------------------------------------
create function public.trg_sessions_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_name text;
begin
  select full_name into v_coach_name from public.profiles where id = new.coach_id;

  if tg_op = 'INSERT' then
    perform public.log_activity(
      'session.created', 'session', new.id,
      jsonb_build_object(
        'session_date', new.session_date,
        'start_time', new.start_time,
        'end_time', new.end_time,
        'coach_name', v_coach_name
      )
    );
  elsif old.cancelled_at is null and new.cancelled_at is not null then
    perform public.log_activity(
      'session.cancelled', 'session', new.id,
      jsonb_build_object('session_date', new.session_date, 'coach_name', v_coach_name)
    );
  end if;
  return null;
end;
$$;

create trigger sessions_activity after insert or update on public.training_sessions
  for each row execute function public.trg_sessions_activity();

-- ---------------------------------------------------------------------------
-- expenses: created (bulk generators set ajyal.bulk = 'on' and log one summary entry themselves)
-- ---------------------------------------------------------------------------
create function public.trg_expenses_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('ajyal.bulk', true), '') = 'on' then
    return null;
  end if;
  perform public.log_activity(
    'expense.created', 'expense', new.id,
    jsonb_build_object('category', new.category, 'amount_fils', new.amount_fils)
  );
  return null;
end;
$$;

create trigger expenses_activity after insert on public.expenses
  for each row execute function public.trg_expenses_activity();

-- ---------------------------------------------------------------------------
-- Realtime: the home feed subscribes to inserts (RLS still decides who receives what)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.activity_log;
