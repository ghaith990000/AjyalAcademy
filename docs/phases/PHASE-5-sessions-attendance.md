# Phase 5 — Sessions & attendance

**Status:** Not started · **Requirements:** R-03, R-04

## Goal

Schedule training sessions (date, start time, end time) and let coaches quickly record who attended, mobile-first.

## Read first

[04-data-model.md](../04-data-model.md) (`training_sessions`, `attendance`, `save_attendance`), [05-business-rules.md](../05-business-rules.md#player-rules) (roster rule), [06-design-system.md](../06-design-system.md) (mobile checklist)

## Tasks

- [ ] `features/sessions`: api/hooks/schemas — zod: date, start time, end time (`end > start`), coach (admin picks; coach = self), location, notes
- [ ] **Schedule a session:** form with date + start/end time pickers; optional **repeat weekly** for N weeks (creates N rows; conflicts with the same coach's overlapping sessions warn)
- [ ] **Sessions page:** week/day agenda list (default today + upcoming), filter by coach (admin), status (upcoming / done / cancelled), edit and **cancel** session
- [ ] `features/attendance`: **Attendance screen** for a session — roster = the session coach's active players; large tap-to-toggle rows (present/absent), "mark all present", live counts, save via `save_attendance` RPC (upsert; editable afterwards); warning badge for players without an active subscription (needs Phase 4 status — degrade gracefully if unavailable)
- [ ] Attendance history: on the **session detail** (who attended) and on the **player detail** (attendance list + attendance rate %)
- [ ] `save_attendance` RPC implemented + SQL tests (only the session's coach or an admin; roster validation; idempotent upsert; one `attendance.saved` log entry)
- [ ] i18n `sessions`, `attendance` namespaces (AR + EN); time formatting per [07-i18n.md](../07-i18n.md#formatting)
- [ ] Tests: schema (end > start), attendance toggling/mark-all, roster filtering

## Acceptance criteria

- A coach schedules a session and sees only their own; an admin sees/edits all and picks the coach.
- Opening a session lists exactly that coach's active players; toggling and saving persists and reloads correctly; re-saving updates rather than duplicating.
- Player detail shows attendance history and rate; cancelled sessions cannot be marked.
- Attendance screen is comfortable one-handed at 390px in AR and EN (rows ≥ 56px tall).
- Docs updated; all checks pass.

## Out of scope

Late/excused statuses (D-023), push notifications, parent-facing views.

## Handoff notes

_(fill in when done)_
