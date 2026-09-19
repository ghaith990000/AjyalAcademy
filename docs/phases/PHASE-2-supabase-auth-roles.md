# Phase 2 — Supabase, auth & roles

**Status:** Not started · **Requirements:** schema for R-01/R-02, seed for R-10, triggers for R-11

## Goal

Real backend: local Supabase (Docker), the full schema with RLS and activity triggers, seeded data, working login, role-based routing, and admin management of coaches.

## Read first

[04-data-model.md](../04-data-model.md) (the contract), [03-architecture.md](../03-architecture.md), [05-business-rules.md](../05-business-rules.md) (for `calc_subscription_total`)

## Tasks

- [ ] `npx supabase init` (creates `supabase/config.toml`); `npx supabase start`; copy URL + anon key into `.env.local`
- [ ] Migrations, in order: enums + helper functions (`is_admin`, `current_role`, `owns_player`) → `profiles`, `players`, `plans`, `settings` → `discounts`, `subscriptions`, `subscription_players`, `payments` → `training_sessions`, `attendance` → `expenses` → `activity_log` (+ Realtime publication) → RLS policies for every table per the matrix → triggers (players/discounts/sessions/expenses activity)
- [ ] RPCs: `calc_subscription_total`, `create_subscription`, `record_payment`, `cancel_subscription`, `assign_players`, `save_attendance`, `generate_monthly_salaries`, `report_summary`, `revenue_by_month`, `expenses_by_category` (stubs OK for later-phase RPCs **only if** the schema/signature matches the doc; implement fully in their own phase)
- [ ] `seed.sql`: plans (20000/35000/50000/60000 fils), settings (placeholders), demo admin + 2 coaches (dev password documented in the phase handoff), ~10 sample players
- [ ] SQL tests in `supabase/tests/`: coach isolation on players/subscriptions/sessions/attendance; coach cannot read `expenses` or call report RPCs; nobody can insert into `activity_log` directly; `players` CPR/disease constraints; activity rows created by triggers with correct actor
- [ ] Generate types: `npx supabase gen types typescript --local > src/lib/database.types.ts`
- [ ] `src/lib/supabase.ts` client; `features/auth`: `AuthProvider` (session + profile/role), `useAuth`, `LoginPage` wired, logout, redirect by role, `RequireRole` guard, inactive users blocked
- [ ] Edge Function `supabase/functions/create-coach` (service role; admin-only caller check; creates auth user + `profiles` row + logs `coach.created`)
- [ ] Admin **Coaches** page: list, add (name, email, phone, monthly salary, temp password), edit, deactivate; translated
- [ ] Persist `preferred_language` to the profile; apply it after login
- [ ] TanStack Query provider + base error/toast handling

## Acceptance criteria

- `npx supabase db reset` applies everything cleanly; `npx supabase test db` passes.
- Login works for seeded admin and coaches; wrong password shows a translated error; admin lands on `/admin`, coach on `/coach`; a coach visiting `/admin/*` is redirected.
- From the browser console with a coach session, querying another coach's players returns nothing (RLS), and inserting into `activity_log` is rejected.
- Admin can create a coach who can then log in.
- Docs updated: schema deviations (if any) reflected in `04-data-model.md`; dev credentials + setup steps in the handoff.

## Out of scope

Player/subscription UIs (Phases 3–4), report UIs (Phase 6).

## Handoff notes

_(fill in when done: local URLs/keys location, dev credentials, migration list, RPC status, gotchas)_
