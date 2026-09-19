# Phase 2 — Supabase, auth & roles

**Status:** Done · **Requirements:** schema for R-01/R-02, seed for R-10, triggers for R-11

## Goal

Real backend: local Supabase (Docker), the full schema with RLS and activity triggers, seeded data, working login, role-based routing, and admin management of coaches.

## Read first

[04-data-model.md](../04-data-model.md) (the contract), [03-architecture.md](../03-architecture.md), [05-business-rules.md](../05-business-rules.md) (for `calc_subscription_total`)

## Tasks

- [x] Backend: the **hosted Supabase project** (`iytfzgvjuinyqyedgsgt`) instead of local Docker (D-030); URL + publishable key in `.env.local`
- [x] Migrations, applied to the hosted project through the Supabase MCP: `core_schema` (enums, tables, constraints, reference data) → `security_rls` (helpers, deny-by-default grants, RLS on every table, guard triggers) → `activity_triggers` (`log_activity`, players/discounts/sessions/expenses triggers, Realtime publication) → `player_rpcs` (`remove_player`) → `rls_initplan` (advisor fix: `(select auth.uid())`). Files: `supabase/migrations/20260919100000…100400`
- [x] RPCs: **`remove_player` only.** The rest are not stubbed and arrive in the phase that uses them (D-032; status table in `04-data-model.md`)
- [x] `seed.sql` (local dev: demo admin + 2 coaches + 10 players) — **not run on the hosted project**; the owner creates a real admin instead (see handoff)
- [x] pgTAP tests in `supabase/tests/database/` (131 assertions, all passing on the hosted project): coach isolation on players/subscriptions/payments/sessions/attendance, coach cannot read `expenses`, nobody writes `activity_log` or calls `log_activity`, CPR/disease/DOB constraints, subscription total constraints, profile guards (incl. last admin), activity rows with the correct actor, privilege audit (D-031). _Deviation:_ report RPCs do not exist yet, so "coach cannot call report RPCs" moves to Phase 6 with the RPCs
- [x] Types generated into `src/lib/database.types.ts`
- [x] `src/lib/supabase.ts`; `features/auth`: `AuthProvider`, `useAuth`, wired `LoginPage`, logout (sidebar and "More" sheet), redirect by role, `RequireRole` / `RedirectIfSignedIn` / `RootRedirect`, inactive users blocked (D-037)
- [x] Edge Function `create-coach` **deployed** (`verify_jwt = true`); checked over HTTP: no token → 401, anon-role token → 401, CORS preflight → 204, no side effects
- [x] Admin **Coaches** page (list, add, edit incl. active switch = deactivate), translated (`coaches` namespace)
- [x] `preferred_language`: applied after sign-in, toggles saved back to the profile
- [x] TanStack Query provider + base error/toast handling (`QueryProvider`, `errors` namespace)

## Acceptance criteria — results

- [x] Schema applies cleanly to the hosted project (5 migrations, no errors); pgTAP suites pass: **131 / 131**. _(`supabase db reset` / `supabase test db` need Docker and were not run here — same SQL.)_
- [x] Security advisor: only the intentional "helper functions executable by signed-in users" notes (D-036). Performance advisor: RLS init-plan warnings fixed; remaining INFO items are unindexed audit-column foreign keys and not-yet-used indexes (nothing to gain on an empty database; revisit in Phase 8).
- [x] Automated: `typecheck`, `lint`, `test` (92), `build` pass — routing/guards (signed-out → `/login`, coach kept out of `/admin`, admin out of `/coach`, signed-in users leave `/login`), `AuthProvider` (session restore, inactive/profile-less users signed out, language applied once and saved back, `signIn` error mapping), login validation + translated errors (AR/EN), Coaches page (list, empty, load error, validation, fils conversion, email-taken, weak password, edit + deactivate).
- [x] **Live, by the owner:** admin logged in and reached the admin area; an admin created a coach through the Coaches page (the Edge Function ran end to end: auth user + profile + `coach.created` in the log); a deactivated coach was refused at login; after reactivation the coach signed in.
- [x] Wrong password shows the translated error — checked in Chrome against the real hosted Auth API (AR/EN, 390px and 1280px, 36 checks).
- [x] Coach redirected away from `/admin/*`, nav has no admin items — unit tests plus Chrome (fake session and mocked profile responses, since Claude has no credentials): AR/EN × 390px/1280px, **60 checks**: no horizontal scroll, dialog fits the viewport, tap targets ≥ 44px, validation translated, email field LTR, sign-out reachable (sidebar on desktop, "More" sheet on phones), no console errors.
- [x] Coach isolation and "nobody inserts into `activity_log`" — proven by the pgTAP suites with real fixtures on the hosted project (not by a manual browser-console query).
- [x] Language persistence — unit-tested (`AuthProvider.test.tsx`); not separately observed live.
- [x] Docs updated: `03-architecture`, `04-data-model` (profiles `email`, coach reads self only, RPC status), `07-i18n`, `08-decisions` (D-030…D-039, Q-008), `09-conventions` (how to run DB tests).

## Out of scope

Player/subscription UIs (Phases 3–4), report UIs (Phase 6).

## Handoff notes

- **Where things are:** migrations `supabase/migrations/`; tests `supabase/tests/database/` (how to run: `09-conventions.md`); Edge Function `supabase/functions/create-coach/` (+ unit tests in `tests/functions/`); client `src/lib/supabase.ts`; auth `src/features/auth/`; coaches `src/features/coaches/`; providers `src/app/providers.tsx` + `QueryProvider.tsx`.
- **Environments:** development uses the hosted project; there is **no separate production project yet** (Q-008). `.env.local` (git-ignored) holds `VITE_SUPABASE_URL` and the publishable key. Never put the service-role key in `src/`.
- **First admin:** `ghaith.alkhudhiri@gmail.com` (display name Ghaith Alkhudhiri) — created 2026-09-19: the owner added the login in the Supabase dashboard and Claude inserted its `profiles` row with `role = 'admin'`. Procedure for any later admin: create the user in the dashboard (Authentication → Users → Add user, auto-confirm), then given a `profiles` row with `role = 'admin'` (insert with the user's id). `seed.sql` (demo accounts with the weak documented password) is for the **local** stack only — do not run it on the hosted project.
- **Adding to the database:** every migration must (1) enable RLS on new tables, (2) grant privileges explicitly (deny by default, D-036), (3) come with a pgTAP test. Apply with the MCP `apply_migration`, keep the file in `supabase/migrations/`, regenerate `database.types.ts`, run the advisors.
- **Gotchas:** PostgreSQL rejects data-modifying CTEs inside sub-selects (tests use `tests.affected($$…$$)`); a plain `UPDATE players SET deleted_at` fails for coaches (use `remove_player`, D-033); after `signInWithPassword`, never `await` other Supabase calls inside `onAuthStateChange` (deadlock) — `AuthProvider` keeps that callback synchronous; `.env.local` is not read by Vitest, so `vite.config.ts` sets dummy values for tests.
- **Browser checks without credentials:** drive Chrome with `playwright-core` (system Chrome, from a scratch folder), pre-seed `localStorage['sb-<project-ref>-auth-token']` with a fake session (far-future `expires_at`) and `localStorage['ajyal.lang']`, and intercept `**/rest/v1/profiles*` (object for `id=eq.…`, array for `role=eq.coach`; answer CORS preflights) and `**/auth/v1/**`. `DataList` renders both a table and cards, so select **visible** elements. Phase 8 adds Playwright to the repo formally.
- **Not done / next:** Phase 3 (players) needs `assign_players` and player screens under both prefixes; the phone app bar shows the page title, not the user's name (only the sidebar and "More" sheet show the user); code-splitting (bundle is ~890 kB) is Phase 8.
