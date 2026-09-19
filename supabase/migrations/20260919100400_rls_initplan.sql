-- Ajyal Academy — RLS performance: evaluate auth.uid() once per statement, not once per row.
--
-- Supabase's performance advisor (lint 0003, auth_rls_initplan) flags policies that call auth.uid()
-- directly. Wrapping it as (select auth.uid()) lets Postgres treat it as an InitPlan. Behaviour is
-- unchanged; the pgTAP suites in supabase/tests/database must still pass.

alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or public.is_admin());

alter policy profiles_update on public.profiles
  using (public.is_admin() or (id = (select auth.uid()) and public.is_active_user()))
  with check (public.is_admin() or (id = (select auth.uid()) and public.is_active_user()));

alter policy players_select on public.players
  using (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid()) and deleted_at is null));

alter policy players_insert on public.players
  with check (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())));

alter policy players_update on public.players
  using (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid()) and deleted_at is null))
  with check (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())));

alter policy training_sessions_select on public.training_sessions
  using (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())));

alter policy training_sessions_insert on public.training_sessions
  with check (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())));

alter policy training_sessions_update on public.training_sessions
  using (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())))
  with check (public.is_admin() or (public.is_active_user() and coach_id = (select auth.uid())));

alter policy activity_log_select on public.activity_log
  using (public.is_admin() or (public.is_active_user() and actor_id = (select auth.uid())));
