# Phase 13 — Payments by subscription month, roster by location

Decisions: D-106, D-107. Migration `20260928100000_payments_by_subscription_month_roster_by_location.sql`.

- [x] `report_summary`, `revenue_by_month`, `report_by_location` count payments by `subscriptions.start_date`; payments CSV filters the same way (`paid_at` remains the receipt date).
- [x] `save_attendance` and the attendance screen: roster = coach's active players at the session's location (null location on either side is not filtered).
- [x] pgTAP: `supabase/tests/database/08_month_and_roster.test.sql`; unit/e2e mocks updated.
- [ ] Run `npm test`, `npm run e2e`, `supabase test db` and check 390px ar/en in a browser (not run in the authoring session: vitest is blocked by group policy on that machine).
