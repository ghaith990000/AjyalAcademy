# Phase 9 — Locations

**Status:** Done — automated and browser checks complete; the owner's live check is pending · **Requirements:** R-17 (answers Q-005)

## Goal

The academy trains and collects money in more than one place. Admins create **locations** in the system; training sessions, subscriptions, expenses (and, as an optional label, players) belong to a location instead of free text, and the reports show fees collected and expenses **per location**.

## Read first

[04-data-model.md](../04-data-model.md) (`training_sessions`, `subscriptions`, `expenses`, report RPCs), [05-business-rules.md](../05-business-rules.md#expenses-and-reports), [06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md), D-063…D-065 (expenses and reports) in [08-decisions.md](../08-decisions.md)

## Decisions taken with the owner (2026-09-20)

- **Money follows the subscription:** each subscription has **one location**, chosen when it is created (the wizard offers the players' location first). Every payment on it counts for that location. Expenses carry an optional location of their own (an expense with none is "academy-wide").
- **Coaches are not tied to locations.** Admins manage locations; a coach schedules at any active location and still sees only their own players and sessions. Nothing about coach access changes.
- The word in the UI is **Location** / **الموقع** everywhere (the owner said "location or branch"; one word keeps the screens consistent — D-084).

## Tasks

- [x] **Migration** `20260920100000_locations.sql`: table `locations` (name, address, active; RLS: every active user reads, admins write; no delete — a location is switched off, never removed) + activity trail (`location.created`, `location.updated`)
- [x] `training_sessions.location_id` (required for new sessions, must be active); **backfill** from the old free-text `location` (one location per distinct name, case-insensitive) and drop the text column; `player_attendance` view rebuilt
- [x] `subscriptions.location_id`: `create_subscription` gets a required `p_location_id`; admin-only `set_subscription_location` (logged) to label older subscriptions or fix a mistake; `subscription_overview` rebuilt with `location_id` / `location_name`
- [x] `expenses.location_id` (optional, must be active when set) and `players.location_id` (optional label, must be active when set)
- [x] Reports: `report_summary`, `revenue_by_month`, `expenses_by_category` take an optional location; new `report_by_location(from, to)` (one row per location + the "no location" row); pgTAP `07_locations.test.sql`
- [x] **Locations page** (admin, `/admin/locations`): list, add, edit, switch off / on; a shared `LocationSelect`
- [x] Sessions: location select instead of text; shown on the agenda, detail, attendance and home; agenda filter
- [x] Subscriptions: location step in the wizard, shown on list and detail; admin can change it; list filter
- [x] Expenses: optional location on the form, shown on the list; list filter
- [x] Players: optional location on the form, shown on the detail; list filter
- [x] Reports: location filter (all / one) on the KPIs, chart, table and categories, a **by-location table** for the period, and a location column in both CSV files
- [x] Activity feed sentences for the new actions; the session-created sentence names the location
- [x] i18n (`locations` namespace + additions), Vitest, e2e mock + audit routes, docs (`04`, `05`, `06`, `07`, `08`, `10`, `11`, requirements, roadmap)

## Acceptance criteria — results

- [x] **An admin can add, rename and switch off a location; a coach can read locations but not change them** — pgTAP (`07`: coach read / insert / update / delete, anon, unique names ignoring case, column grants, the activity trail) and the browser tests (add and rename on the Locations page; the audit visits the page and its dialog in both languages).
- [x] **A session cannot be created without an active location; existing free-text sessions kept their place** — pgTAP for the guard; the migration was dry-run on the real data inside a rolled-back transaction (19 sessions, 6 distinct names → 6 locations, 15 sessions linked, 4 that never had text left empty, the guard trigger back on), then applied.
- [x] **Collected per location = payments on that location's subscriptions; expenses per location = its own; the rows add up** — pgTAP with exact October-2025 numbers: all 260 000 / 125 000 / 135 000 (51.92 %), L1 150 000 / 40 000, L2 80 000 / 25 000, "no location" 30 000 / 60 000; the per-location rows sum to the all-locations figures; month, year and category variants; boundaries (the 1 Nov and 30 Sep rows stay out).
- [x] **Reports, both CSV files, the agenda and the wizard work in Arabic and English at 390px with no sideways scroll** — the audit (axe + layout) covers every screen, plus flows for the split, the filter and adding a location; screenshots were looked at (Locations list and dialog, reports, session form, wizard, subscription page; ar and en).
- [x] `typecheck`, `lint`, `test` (703), `build`, `e2e` (111) pass; pgTAP passes on the hosted project, every file rolled back: 520 assertions (01: 80, 02: 51, 03: 22, 04: 121, 05: 83, 06: 77, 07: 86); advisors: only the intentional SECURITY DEFINER notes (18 functions now) and the leaked-password setting; the real rows are untouched by the test runs.
- [ ] **Owner's live check** with the real accounts (add the real locations, switch off the test ones, create a session and a subscription, look at the report split).

## Out of scope

Coaches assigned to locations, location-specific plan prices or fees, per-location settings, moving money between locations, deleting a location.

## Handoff notes

- **The database was migrated on the hosted project on 2026-09-20** (file `20260920100000_locations.sql`; recorded there under its apply-time name `locations`). Deploy the website from this commit **after** that (it already happened): an older website would still send the removed `location` column.
- **What the owner will see first:** six locations created from the free text typed on earlier sessions — two real ones (`ملعب حديقة الرفاع`, `ملعب فرع مدينة حمد`) and four that look like test entries (`dafsa`, `fsdfs`, `fsdfsfs`, `Udhhdhd`). Switch the test ones off under **More → Locations** (they cannot be deleted, D-084). The four subscriptions and eight expenses that existed have **no location** yet: give the subscriptions one with **Change location**, edit the expenses; until then the reports show them in the "No location" row. Four old sessions never had a place typed and also have none (edit them to pick one).
- **The admin feed shows six "Someone added the location …" entries** written by the migration's backfill (the trigger existed then). The migration _file_ now creates the trigger after the backfill, so a fresh install does not do this; the live audit log was left alone.
- **Where things are:** SQL `supabase/migrations/20260920100000_locations.sql`, `supabase/tests/database/07_locations.test.sql`; TS `src/features/locations` (+ `LocationField` used by the session, player, expense and subscription screens), `src/features/reports/{LocationBreakdown,hooks,api}.ts`, `draft.ts` (`sharedPlayerLocation`, `effectiveLocationId`), `SubscriptionLocationDialog.tsx`; test defaults `src/test/{setup,locations}.ts`; e2e mock `e2e/support/mock-api.ts`. Docs: `04` "As built (Phase 9)", `05` "Locations", `03`, `06`, `07`, `09`, `10`, `11`; decisions D-084…D-089.
- **Gotchas:** views that read `s.*` freeze their column list — a new column on `subscriptions` needs the views recreated; a required-but-defaulted test setup (`alter table … set default`) keeps old pgTAP files working without touching every insert; `LocationSelect` re-mounts when the list arrives so a form's default value is applied; with `getByLabelText('Location')` in Playwright pass `exact: true` (the by-location table's region name contains the word); the overlap warning in the session form must not wait for the location (it parses the form with a placeholder location).
- **Known limits (by design):** a location can be switched off but not deleted or merged (two names for one place stay two locations); coaches are not tied to locations (D-087); payments cannot be split between locations inside one subscription; the reports' "No location" row is the only place older money without a location shows; a single location's figures leave out academy-wide expenses (D-085, D-089); changing a subscription's location moves _all_ its payments, including past months.
- **Phase 10** (public registration) can now offer the location list to parents: it needs a public function that returns the active locations' names (`public_locations()`), since `anon` has no table access.
