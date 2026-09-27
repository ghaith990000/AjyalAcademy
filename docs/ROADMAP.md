# Roadmap

Single source of progress. Work **one phase at a time, in order**. Status values: `Not started` · `In progress` · `Done` (verified per the Definition of Done in [09-conventions.md](09-conventions.md)).

| #   | Phase                                    | Status   | Delivers requirements                            | File                                                 |
| --- | ---------------------------------------- | -------- | ------------------------------------------------ | ---------------------------------------------------- |
| 0   | Docs & scaffold                          | **Done** | R-13, R-16 (base), R-14 (base)                   | [PHASE-0](phases/PHASE-0-docs-and-scaffold.md)       |
| 1   | Design system & app shell                | **Done** | R-05, R-14, R-15                                 | [PHASE-1](phases/PHASE-1-design-system-and-shell.md) |
| 2   | Supabase, auth & roles                   | **Done** | R-01/R-02 (schema), R-10 (seed), R-11 (triggers) | [PHASE-2](phases/PHASE-2-supabase-auth-roles.md)     |
| 3   | Players                                  | **Done** | R-01, R-06, R-07                                 | [PHASE-3](phases/PHASE-3-players.md)                 |
| 4   | Subscriptions, fees, discounts, payments | **Done** | R-02, R-10, R-12                                 | [PHASE-4](phases/PHASE-4-subscriptions.md)           |
| 5   | Sessions & attendance                    | **Done** | R-03, R-04                                       | [PHASE-5](phases/PHASE-5-sessions-attendance.md)     |
| 6   | Finance & reports                        | **Done** | R-08, R-09                                       | [PHASE-6](phases/PHASE-6-finance-reports.md)         |
| 7   | Home dashboards & activity feed          | **Done** | R-11                                             | [PHASE-7](phases/PHASE-7-home-and-activity.md)       |
| 8   | Polish & release                         | **Done** | R-05 (verify), R-14, R-15                        | [PHASE-8](phases/PHASE-8-polish-release.md)          |
| 9   | Locations                                | **Done** | R-17                                             | [PHASE-9](phases/PHASE-9-locations.md)               |
| 10  | Public player registration               | **Done** | R-18                                             | [PHASE-10](phases/PHASE-10-player-registration.md)   |
| 11  | CPR documents & player photos            | **Done** | R-19                                             | [PHASE-11](phases/PHASE-11-uploads.md)               |
| 12  | Per-player fee overrides                 | **Done** | R-20                                             | [PHASE-12](phases/PHASE-12-fee-overrides.md)         |

## Dependency notes

- Phase 1 needs no backend (static screens). Phase 2 unlocks every data phase.
- Phase 4 depends on Phase 3 (players). Phase 5 depends on Phase 3. Phase 6 depends on Phase 4 (payments). Phase 7 depends on Phases 2–6 (it surfaces their data).
- Open questions ([08-decisions.md](08-decisions.md)) Q-001…Q-004 should be answered before Phase 4 starts; placeholders are used otherwise.

- Phases 9–12 were added after the first release at the owner's request. Phase 10 depends on Phase 9 (the registration form asks for a location). Phase 11 depends on Phase 10 (a parent's CPR file is attached to the same request the form already sends). Phase 12 depends on Phase 4 (it extends `create_subscription`) only.

## Change history

| Date       | Change                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-19 | Phase 0 completed: docs written, Vite/React/TS/Tailwind/i18n/Vitest scaffold, brand assets.                                                                                                                                                |
| 2026-09-19 | Phase 1 completed: design system, app shells (admin/coach), login screen, dev gallery, i18n typing + guard tests.                                                                                                                          |
| 2026-09-19 | Phase 2 completed: hosted Supabase (schema, RLS, triggers, `remove_player`), pgTAP tests, auth + role guards, Coaches page, `create-coach` function.                                                                                       |
| 2026-09-19 | Phase 3 completed: players registry (list, search, filters, add/edit, detail, soft delete), coach assignment (single + bulk `assign_players`).                                                                                             |
| 2026-09-19 | Phase 4 completed: pricing (TS + SQL, pinned to the worked examples), create/record/cancel subscription RPCs, subscription wizard/list/detail, settings and discounts pages.                                                               |
| 2026-09-19 | Phase 5 completed: sessions (schedule, weekly repeat, edit, cancel, agenda), attendance screen + `save_attendance` RPC, attendance history and rate on the player page.                                                                    |
| 2026-09-19 | Phase 6 completed: expenses (CRUD, month filter, category chips, monthly salary generation), report functions (summary, by month, by category), Reports page with chart and CSV export.                                                    |
| 2026-09-19 | Phase 7 completed: home dashboards for admins and coaches (KPIs, today's sessions, expiring subscriptions, quick actions) and the live activity feed.                                                                                      |
| 2026-09-20 | Phase 8 completed: installable PWA (offline shell, update prompt), accessibility and resilience pass, code splitting, Playwright suite, deployment and user guides, docs audit.                                                            |
| 2026-09-20 | Phases 9 (locations) and 10 (public player registration) added to the roadmap at the owner's request.                                                                                                                                      |
| 2026-09-20 | Phase 9 completed: locations (sessions, subscriptions, expenses and players by location; reports and CSV split and filtered by location; the free-text session place migrated).                                                            |
| 2026-09-20 | Phase 10 completed: a public registration form for parents (no login, up to 4 children), an admin review screen (accept creates the player, reject keeps the request), a one-tap WhatsApp message to the parent, home card and menu badge. |
| 2026-09-25 | Phase 11 added to the roadmap and completed the same day: an optional CPR file (image or PDF) a parent may attach per child on the registration form; a photo and a CPR file an admin (or the player's coach) can add from the player page; a private Storage bucket with its own RLS, mirroring the existing "no oracle" and "admin all / coach own" rules. |
| 2026-09-27 | Phase 12 added to the roadmap and completed the same day: an admin can type a special T-shirt and/or transport price for one player, one subscription only (not remembered on the player record), instead of the unified Settings fee; a coach's attempt is ignored server-side. |
