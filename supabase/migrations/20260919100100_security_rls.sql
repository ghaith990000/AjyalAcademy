-- Ajyal Academy — access control: helper functions, privileges, RLS policies, guard triggers.
-- Permission matrix: docs/04-data-model.md#rls-matrix
--
-- Model: RLS is the security boundary. Supabase grants broad default privileges to `anon` and
-- `authenticated`; we REVOKE everything and grant back only what each role needs, so the
-- policies below are the only way in. Every future migration that adds a table or function must
-- do the same (an RLS test fails if `anon` gains any privilege).

-- ---------------------------------------------------------------------------
-- Lock the defaults down FIRST, so every function/table created below (and in later migrations)
-- starts with no access for anon / authenticated / PUBLIC and must be granted explicitly.
-- (The global form is needed: Postgres gives PUBLIC EXECUTE on new functions by default, and a
-- schema-scoped ALTER DEFAULT PRIVILEGES cannot remove that.)
-- ---------------------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies can read `profiles` etc. without recursion)
-- ---------------------------------------------------------------------------
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active and role = 'admin'
  )
$$;

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- True when the player is (not removed and) assigned to the calling active user.
create function public.owns_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.players p
    where p.id = p_player_id and p.coach_id = auth.uid() and p.deleted_at is null
  )
$$;

-- Admins see every subscription; coaches see those that contain at least one of their players.
create function public.can_view_subscription(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (
    public.is_active_user() and exists (
      select 1
      from public.subscription_players sp
      join public.players p on p.id = sp.player_id
      where sp.subscription_id = p_subscription_id and p.coach_id = auth.uid()
    )
  )
$$;

-- Admins see every session; coaches see the sessions they run.
create function public.can_view_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (
    public.is_active_user() and exists (
      select 1 from public.training_sessions s
      where s.id = p_session_id and s.coach_id = auth.uid()
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant back what is needed (RLS then narrows rows)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

grant usage on schema public to authenticated;

grant execute on function
  public.is_active_user(),
  public.is_admin(),
  public.current_user_role(),
  public.owns_player(uuid),
  public.can_view_subscription(uuid),
  public.can_view_session(uuid)
to authenticated;

grant select on all tables in schema public to authenticated;
grant update on public.profiles to authenticated;                        -- trigger + RLS narrow this
grant insert, update on public.players to authenticated;                 -- removal goes through remove_player()
grant insert, update on public.plans to authenticated;                   -- admin only (RLS)
grant update on public.settings to authenticated;                        -- admin only (RLS)
grant insert, update on public.discounts to authenticated;
grant insert, update on public.training_sessions to authenticated;
grant insert, update, delete on public.expenses to authenticated;        -- admin only (RLS)
-- subscriptions, subscription_players, payments, attendance, activity_log: SELECT only.
-- Their writes happen in SECURITY DEFINER functions/triggers (later migrations/phases).

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.plans enable row level security;
alter table public.settings enable row level security;
alter table public.discounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_players enable row level security;
alter table public.payments enable row level security;
alter table public.training_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.expenses enable row level security;
alter table public.activity_log enable row level security;

-- profiles: a user reads themself; admins read and edit everyone. No insert/delete for clients
-- (accounts are created by the create-coach Edge Function with the service role).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin() or (id = auth.uid() and public.is_active_user()))
  with check (public.is_admin() or (id = auth.uid() and public.is_active_user()));

-- players
create policy players_select on public.players for select to authenticated
  using (public.is_admin() or (public.is_active_user() and coach_id = auth.uid() and deleted_at is null));
create policy players_insert on public.players for insert to authenticated
  with check (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()));
create policy players_update on public.players for update to authenticated
  using (public.is_admin() or (public.is_active_user() and coach_id = auth.uid() and deleted_at is null))
  with check (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()));

-- plans / settings: everyone active reads, admins write
create policy plans_select on public.plans for select to authenticated using (public.is_active_user());
create policy plans_insert on public.plans for insert to authenticated with check (public.is_admin());
create policy plans_update on public.plans for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_select on public.settings for select to authenticated using (public.is_active_user());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- discounts: admins manage; coaches can only see active ones
create policy discounts_select on public.discounts for select to authenticated
  using (public.is_admin() or (public.is_active_user() and active));
create policy discounts_insert on public.discounts for insert to authenticated with check (public.is_admin());
create policy discounts_update on public.discounts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- subscriptions family: read-only for clients
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.can_view_subscription(id));
create policy subscription_players_select on public.subscription_players for select to authenticated
  using (public.can_view_subscription(subscription_id));
create policy payments_select on public.payments for select to authenticated
  using (public.can_view_subscription(subscription_id));

-- training sessions: admins all; coaches only the ones they run
create policy training_sessions_select on public.training_sessions for select to authenticated
  using (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()));
create policy training_sessions_insert on public.training_sessions for insert to authenticated
  with check (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()));
create policy training_sessions_update on public.training_sessions for update to authenticated
  using (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()))
  with check (public.is_admin() or (public.is_active_user() and coach_id = auth.uid()));

-- attendance: read-only for clients (writes go through save_attendance)
create policy attendance_select on public.attendance for select to authenticated
  using (public.can_view_session(session_id));

-- expenses: admin only
create policy expenses_select on public.expenses for select to authenticated using (public.is_admin());
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_admin());
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_admin());

-- activity_log: admins read all, others read only what they did. Nobody writes from the client.
create policy activity_log_select on public.activity_log for select to authenticated
  using (public.is_admin() or (public.is_active_user() and actor_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Guard triggers: rules RLS cannot express (column-level and cross-row)
-- ---------------------------------------------------------------------------

-- profiles: non-admins may not touch role/salary/active/email; the last active admin cannot be
-- demoted or deactivated (that would lock everyone out). No auth.uid() = service role/migrations.
create function public.trg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.monthly_salary_fils is distinct from old.monthly_salary_fils
       or new.active is distinct from old.active
       or new.email is distinct from old.email then
      raise exception 'ajyal:forbidden_profile_change' using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles p where p.role = 'admin' and p.active and p.id <> old.id
     ) then
    raise exception 'ajyal:last_admin' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.trg_profiles_guard();

-- players: coaches always own what they create, cannot reassign or restore, date of birth in the past.
create function public.trg_players_guard()
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

create trigger players_guard before insert or update on public.players
  for each row execute function public.trg_players_guard();
