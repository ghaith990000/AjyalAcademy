# Roadmap

Single source of progress. Work **one phase at a time, in order**. Status values: `Not started` · `In progress` · `Done` (verified per the Definition of Done in [09-conventions.md](09-conventions.md)).

| #   | Phase                                    | Status      | Delivers requirements                            | File                                                 |
| --- | ---------------------------------------- | ----------- | ------------------------------------------------ | ---------------------------------------------------- |
| 0   | Docs & scaffold                          | **Done**    | R-13, R-16 (base), R-14 (base)                   | [PHASE-0](phases/PHASE-0-docs-and-scaffold.md)       |
| 1   | Design system & app shell                | **Done**    | R-05, R-14, R-15                                 | [PHASE-1](phases/PHASE-1-design-system-and-shell.md) |
| 2   | Supabase, auth & roles                   | **Done**    | R-01/R-02 (schema), R-10 (seed), R-11 (triggers) | [PHASE-2](phases/PHASE-2-supabase-auth-roles.md)     |
| 3   | Players                                  | **Done**    | R-01, R-06, R-07                                 | [PHASE-3](phases/PHASE-3-players.md)                 |
| 4   | Subscriptions, fees, discounts, payments | **Done**    | R-02, R-10, R-12                                 | [PHASE-4](phases/PHASE-4-subscriptions.md)           |
| 5   | Sessions & attendance                    | Not started | R-03, R-04                                       | [PHASE-5](phases/PHASE-5-sessions-attendance.md)     |
| 6   | Finance & reports                        | Not started | R-08, R-09                                       | [PHASE-6](phases/PHASE-6-finance-reports.md)         |
| 7   | Home dashboards & activity feed          | Not started | R-11                                             | [PHASE-7](phases/PHASE-7-home-and-activity.md)       |
| 8   | Polish & release                         | Not started | R-05 (verify), R-14, R-15                        | [PHASE-8](phases/PHASE-8-polish-release.md)          |

## Dependency notes

- Phase 1 needs no backend (static screens). Phase 2 unlocks every data phase.
- Phase 4 depends on Phase 3 (players). Phase 5 depends on Phase 3. Phase 6 depends on Phase 4 (payments). Phase 7 depends on Phases 2–6 (it surfaces their data).
- Open questions ([08-decisions.md](08-decisions.md)) Q-001…Q-004 should be answered before Phase 4 starts; placeholders are used otherwise.

## Change history

| Date       | Change                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-19 | Phase 0 completed: docs written, Vite/React/TS/Tailwind/i18n/Vitest scaffold, brand assets.                                                                                  |
| 2026-09-19 | Phase 1 completed: design system, app shells (admin/coach), login screen, dev gallery, i18n typing + guard tests.                                                            |
| 2026-09-19 | Phase 2 completed: hosted Supabase (schema, RLS, triggers, `remove_player`), pgTAP tests, auth + role guards, Coaches page, `create-coach` function.                         |
| 2026-09-19 | Phase 3 completed: players registry (list, search, filters, add/edit, detail, soft delete), coach assignment (single + bulk `assign_players`).                               |
| 2026-09-19 | Phase 4 completed: pricing (TS + SQL, pinned to the worked examples), create/record/cancel subscription RPCs, subscription wizard/list/detail, settings and discounts pages. |
