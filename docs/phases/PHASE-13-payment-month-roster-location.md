# Phase 13 — Payments by subscription month, roster by location

Decisions: D-106, D-107. Migration `20260928100000_payments_by_subscription_month_roster_by_location.sql` (written on `phase-13-untested`; **not yet applied to the hosted project** as of this check).

- [x] `report_summary`, `revenue_by_month`, `report_by_location` count payments by `subscriptions.start_date`; payments CSV filters the same way (`paid_at` remains the receipt date).
- [x] `save_attendance` and the attendance screen: roster = coach's active players at the session's location (null location on either side is not filtered).
- [x] pgTAP: `supabase/tests/database/10_month_and_roster.test.sql` — the file this checklist originally named (`08_month_and_roster.test.sql`) was never written, and `08` was already taken by `08_applications.test.sql`; this is the real, correctly-numbered file, written during the testing session below.
- [x] Unit tests (`AttendancePage.test.tsx`) updated for the new `listRoster(coachId, locationId)` signature.
- [x] e2e mock (`e2e/support/mock-api.ts`): the `players` route's `or=` parsing only understood the search box's `ilike.%…%` shape and silently ignored the new roster `or=(location_id.is.null,location_id.eq.…)` filter — found and fixed during testing, along with the e2e world fixture (`se2` shared its players' location so "the whole roster" test kept meaning that; a new player `p9` + session `se7` at the other location exercise the exclusion directly).

## Testing session (2026-10-13) — what was actually verified, and what was not

Picked up as an untested branch from another machine. Everything below was run from scratch:

- [x] `npm run typecheck`, `npm run lint`, `npm test` (840), `npm run build`, `npm run e2e` (155, after the mock/fixture fix above) — all pass on this branch.
- [x] The new `listRoster` PostgREST filter shape (`or=(location_id.is.null,location_id.eq.<id>)`) confirmed well-formed against the **real hosted project** (anon key, curl): a well-formed request is refused with `42501` (RLS), a deliberately-wrong column name fails earlier with `42703` — proving the filter itself parses correctly.
- [x] The exact join/aggregation logic behind D-106 and the exact boolean predicate behind D-107 were verified independently, as **pure read-only queries over literal/synthetic data** (no real table touched, nothing written) — both match the decisions exactly, including all five location-pairing cases for D-107 (same location, different location, player with none, session with none, neither).
- [ ] **Not run: the pgTAP suite against the hosted database** (this file, plus a re-run of `06_finance_reports.test.sql` and `07_locations.test.sql`, which were edited on this branch to fit the new payment-month fixture shape). The migration is not yet applied, and a rolled-back `execute_sql` transaction combining `create or replace function` with `delete from payments/expenses` was declined by the permission system each time it was attempted in this session — even after being explicitly allowed once. Needs either: the project owner granting that MCP call, or `supabase test db` run by hand, or a future session retrying it.
- [ ] **Not verified: a real browser at 390px, ar + en.**

## Out of scope for this testing pass

Applying the migration to the hosted project — deliberately left undone pending the pgTAP run above (a migration already pgTAP-verified is the established bar before `apply_migration`, same as every prior phase).
