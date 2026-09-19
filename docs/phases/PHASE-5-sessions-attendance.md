# Phase 5 — Sessions & attendance

**Status:** Done — automated and browser checks complete; owner's live check pending · **Requirements:** R-03, R-04

## Goal

Schedule training sessions (date, start time, end time) and let coaches quickly record who attended, mobile-first.

## Read first

[04-data-model.md](../04-data-model.md) (`training_sessions`, `attendance`, `save_attendance`), [05-business-rules.md](../05-business-rules.md#player-rules) (roster rule), [06-design-system.md](../06-design-system.md) (mobile checklist)

## Tasks

- [x] `features/sessions`: api/hooks/schemas — zod: date, start time, end time (`end > start`), coach (admin picks; coach = self), location, notes. Pure rules in `schedule.ts` (status, overlaps, weekly dates, agenda grouping)
- [x] **Schedule a session:** form with date + start/end time pickers; optional **repeat weekly** for N weeks (2–26, the first included; one multi-row insert = all-or-nothing); a clash with the same coach's overlapping sessions **warns** (never blocks). Edit form for a single session
- [x] **Sessions page:** agenda grouped by day (Today / Tomorrow / long date), default "Today & upcoming", filters by status (done / cancelled / all) and coach (admin), "Show more" paging, edit and **cancel** (final, with a confirmation)
- [x] `features/attendance`: **Attendance screen** for a session — roster = the session coach's active players; large tap-to-toggle rows (64px, present/absent), "mark all present" / "clear all", live counts, save via `save_attendance` RPC (upsert; editable afterwards); warning badge for players without a subscription covering the session's day (degrades to no badges if the lookup fails — D-057)
- [x] Attendance history: on the **session detail** ("Who attended" + summary) and on the **player detail** (rate % + paged history)
- [x] `save_attendance` RPC + sessions guard trigger + `player_attendance` view, with SQL tests (`supabase/tests/database/05_sessions_attendance.test.sql`, 83 assertions): only the session's coach or an admin; roster validation; idempotent upsert; atomic; one `attendance.saved` log entry; coach isolation. Migrations `20260919100700_sessions_attendance.sql`, `20260919100800_save_attendance_session_lookup.sql` and `20260919100900_attendance_not_in_future.sql`
- [x] i18n `sessions`, `attendance` namespaces (AR + EN); time formatting per [07-i18n.md](../07-i18n.md#formatting) (`formatTimeRange`, D-060)
- [x] Tests: schema (end > start, repeat weeks), overlaps/status/weekly dates, attendance toggling / mark-all / has-changes / rate, roster + saved-marks behaviour, sessions page, form dialog, session detail, player attendance card (Vitest: 417 tests in total)

## Acceptance criteria — results

- [x] A coach schedules a session and sees only their own; an admin sees/edits all and picks the coach (pgTAP: RLS isolation on sessions and attendance; component tests: the coach filter/names are admin-only; browser: an admin sees the other coach's session, a coach does not).
- [x] Opening a session lists exactly that coach's active players; toggling and saving persists and reloads correctly; re-saving updates rather than duplicating (pgTAP: one row per player, statuses, unchanged rows keep their marker; component tests: saved marks preload, the payload covers the roster only; browser: 8-player roster, 8 records saved).
- [x] Player detail shows attendance history and rate; cancelled sessions and sessions dated in the future cannot be marked (pgTAP `session_cancelled` / `session_in_future`, D-062; the screen shows a notice instead of a roster and the buttons are not offered; the view leaves cancelled sessions out of history and rate).
- [x] Attendance screen is comfortable one-handed at 390px in AR and EN (every row ≥ 56px — `min-h-16` = 64px; Save stays visible above the tab bar without scrolling and after scrolling to the end).
- [x] 390px and 1280px, Arabic and English, coach and admin: no horizontal scroll, tap targets ≥ 44px (the switch's label row is the target, as in the design system), dialogs inside the viewport, RTL mirrored, long Arabic and long English names wrap, no console errors — 452 checks in Chrome with mocked API responses (Claude has no login), plus a look at the screenshots (which found and fixed the Arabic time-range bug, D-060).
- [x] Every new request shape checked against the hosted project as `anon` (13 shapes accepted by PostgREST → "permission denied"; three deliberately wrong controls fail at parsing with `PGRST200` / `42703` / `PGRST100`).
- [x] `typecheck`, `lint`, `test` (417), `build` pass; pgTAP 83/83 on the hosted project; advisors: only the intentional SECURITY DEFINER note for `save_attendance` and the known leaked-password setting; docs updated (`02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`).
- [ ] **Owner's live check** with the real accounts.

## Out of scope

Late/excused statuses (D-023), push notifications, parent-facing views.

## Handoff notes

_Update:_ after the first commit the owner asked that attendance **cannot be taken for a future-dated session** — done in migration `…100900_…`, the screens and tests (D-062).

- **Where things are:** SQL `supabase/migrations/20260919100700_sessions_attendance.sql` (+ the small follow-up `…100800_…`) and `05_sessions_attendance.test.sql`; TS `src/features/sessions` (`schedule.ts`, `schema.ts` hold the rules), `src/features/attendance` (`marks.ts` holds the screen's rules); fixtures `src/test/sessions.ts`; `formatTimeRange` in `src/lib/dates.ts`; `usePlayersCoveredOn` in the subscriptions feature. Architecture: `03-architecture.md` → "As built (Phase 5)"; SQL contract: `04-data-model.md` → "As built (Phase 5)".
- **Decisions to confirm with the owner** (D-055…D-062): the default agenda view ("Today & upcoming"), attendance starting everyone absent, weekly repeat capped at 26, cancelling a session being final. Nothing here needed a new open question.
- **Phase 6 (finance & reports):** unrelated to this phase's tables. **Phase 7 (home & activity):** `session.created`, `session.cancelled` and `attendance.saved` are logged with `summary` snapshots (`session_date`, `start_time`, `coach_name`; attendance adds `present_count`, `total_count`) — the feed needs a translated sentence for each; a repeat-weekly series logs one `session.created` per session. "Today's sessions" for the dashboards can reuse `listSessions` with the default filter.
- **Gotchas:** every row written in one transaction shares the same `now()`, so pgTAP assertions must not rely on `order by created_at`; `for update` on a session that does not exist returns no row — `can_view_session` is true for every admin, so `save_attendance` checks `found` itself; postgrest-js `.range()` sends `limit`/`offset` (not a `Range` header), which matters for any mock; Radix renders each toast twice (visible + screen-reader copy), so browser selectors need `.first()`; in zsh never write `local path=…` (it overwrites `PATH`); `database.types.ts` gained the view and the function by hand in the generator's format — regenerate when convenient.
- **Known limits (by design):** the future-date rule is checked when attendance is saved; moving a session that already has attendance to a later date is not blocked (rare; the marks simply stay); a coach's attendance history/rate only covers sessions they run (RLS), so after a player is reassigned the new coach sees marks from their own sessions only; editing one session of a weekly series does not touch the others (each is its own row); a cancelled session cannot be reopened (schedule a new one).
- **Pre-existing, not touched:** on the player detail page the phone number link in the info card is an 18px-tall tap target (Phase 3); the Arabic placeholder in an empty `dir="auto"` input aligns to the left; the bundle is ~1.06 MB and still needs code-splitting (Phase 8).
