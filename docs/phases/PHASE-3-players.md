# Phase 3 — Players

**Status:** Not started · **Requirements:** R-01, R-06, R-07

## Goal

Complete player registry: create/edit/view/remove players with medical info; coaches manage their own list; admin distributes players to coaches.

## Read first

[04-data-model.md](../04-data-model.md) (`players`, RLS), [05-business-rules.md](../05-business-rules.md#player-rules), [06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md)

## Tasks

- [ ] `features/players`: `api`, hooks (`usePlayers`, `usePlayer`, `useCreatePlayer`, `useUpdatePlayer`, `useRemovePlayer`, `useAssignPlayers`), zod schema (name, CPR 9 digits, DOB in past, address, school, phone, `hasDisease`, `diseaseDescription` required iff `hasDisease`)
- [ ] **Players list** (`DataList`): search by name / CPR / phone, filter by coach (admin) and by "has condition", sort; shows age (from DOB), school, coach, subscription status badge (placeholder until Phase 4), medical-condition indicator; pagination or infinite scroll
- [ ] **Add/Edit player form** (full-screen sheet on mobile): all fields, disease `Switch` reveals a required description textarea; `inputMode` numeric for CPR, `tel` for phone; duplicate-CPR error links to the existing player
- [ ] **Player detail page:** profile card, medical info (highlighted), coach, and empty placeholders for subscriptions/attendance (filled in Phases 4–5)
- [ ] **Remove player** (soft delete) with confirm dialog; record `deleted_by`
- [ ] **Coach assignment (admin only):** assign on the player page and **bulk assign** from the list (multi-select → choose coach); "Unassigned" filter
- [ ] Coach view: automatically scoped by RLS; new players auto-assigned to the coach; coach cannot see the coach picker
- [ ] i18n `players` namespace (AR + EN), incl. validation messages and confirm dialogs
- [ ] Tests: schema (disease conditional), form behaviour, list search/filter, RLS behaviour verified with the Phase 2 SQL tests plus new cases if needed
- [ ] Verify activity rows appear (`player.created/removed/reassigned`) — feed UI comes in Phase 7

## Acceptance criteria

- Admin and coach can add a player with every required field; toggling disease shows/hides and enforces the description.
- Coach sees only their players; admin sees all and can reassign one or many; reassigned players immediately disappear from the old coach's list.
- Removed players vanish from lists but their rows remain; the removal is in `activity_log` with the correct actor.
- All screens work at 390px in AR and EN; `typecheck`, `lint`, `test`, `build` pass; docs updated.

## Out of scope

Subscriptions/payments (Phase 4), attendance (Phase 5), activity feed UI (Phase 7).

## Handoff notes

_(fill in when done)_
