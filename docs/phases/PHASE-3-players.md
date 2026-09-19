# Phase 3 — Players

**Status:** Done — automated and browser checks complete; owner's live check pending · **Requirements:** R-01, R-06, R-07

## Goal

Complete player registry: create/edit/view/remove players with medical info; coaches manage their own list; admin distributes players to coaches.

## Read first

[04-data-model.md](../04-data-model.md) (`players`, RLS), [05-business-rules.md](../05-business-rules.md#player-rules), [06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md)

## Tasks

- [x] `features/players`: `api`, hooks (`usePlayers` → `usePlayersList`, `usePlayer`, `useCreatePlayer`, `useUpdatePlayer`, `useRemovePlayer`, `useAssignPlayers`), zod schema (name, CPR 9 digits, DOB in the past, address, school, phone, `has_disease`, description required iff `has_disease`)
- [x] **Players list** (`DataList`): search by name / CPR / phone (debounced), coach filter (admin) incl. "Unassigned", "has condition" filter, sort (name / newest), age from DOB, school, phone, coach, medical-condition badge, "Show more" paging (20 per page). _Deviation:_ no subscription-status badge yet (D-040) — Phase 4 adds it
- [x] **Add/Edit player form** (full-screen sheet on phones): every field; the condition `Switch` reveals a required description; `inputMode` numeric for CPR and `tel` for phone; duplicate-CPR error links to the existing player when the user may see it (D-043)
- [x] **Player detail page:** profile card, details, highlighted medical information, coach (admin), placeholders for subscriptions and attendance (Phases 4–5)
- [x] **Remove player** (soft delete via `remove_player`) behind a confirm dialog; `deleted_by` recorded
- [x] **Coach assignment (admin only):** single on the detail page and **bulk** from the list (multi-select → choose a coach or unassign); "Unassigned" filter. New RPC `assign_players` (migration `20260919100500`, D-042)
- [x] Coach view scoped by RLS; new players are auto-assigned to the coach; no coach picker, column or selection boxes for coaches
- [x] i18n `players` namespace (AR + EN) incl. validation messages and confirm dialogs
- [x] Tests: schema (conditional description, CPR, DOB, phone), form behaviour, list search/filter/paging/bulk assign, detail/remove/assign; **pgTAP `03_assign_players`** (22 assertions) — 153 pgTAP assertions in total, all passing on the hosted project
- [x] Activity rows verified: `player.created/removed/reassigned` are asserted with the correct actor in the pgTAP suites (feed UI is Phase 7)

## Acceptance criteria — results

- [x] Admin and coach can add a player with every required field; the condition switch shows/hides the description and enforces it — form tests (both roles, both outcomes).
- [x] A coach sees only their players (RLS — pgTAP, plus a coach never receives the coach list); an admin sees all and can reassign one or many (`assign_players`, pgTAP: the old coach loses the players and the new coach sees them immediately, same transaction).
- [x] Removed players vanish from lists but their rows remain; the removal is logged with the correct actor (pgTAP).
- [x] 390px and desktop, Arabic and English: no horizontal scroll on the list, detail page, add form, bulk bar and assign dialog; forms and dialogs fit the viewport; tap targets ≥ 44px; CPR/phone/date fields LTR; long Arabic names and text wrap; coach view has no coach column, filter or checkboxes; no console errors. _(Chrome driven with mocked API responses — Claude has no login.)_
- [x] Real API shapes checked against the hosted project as `anon`: every list/detail/insert/RPC request is accepted by PostgREST (reaches "permission denied"), while deliberately wrong ones fail at parsing (`PGRST200`, `PGRST202`).
- [x] `typecheck`, `lint`, `test` (171), `build` pass; docs updated.
- [ ] **Owner's live check** with the real admin and coach accounts (see the testing guide given with the commit).

## Out of scope

Subscriptions/payments (Phase 4), attendance (Phase 5), activity feed UI (Phase 7).

## Handoff notes

- **Where things are:** `src/features/players/*` (see `03-architecture.md` → "As built (Phase 3)"); migration `supabase/migrations/20260919100500_assign_players.sql`; pgTAP `supabase/tests/database/03_assign_players.test.sql`; fixtures for tests in `src/test/players.ts`; date helpers `ageInYears`, `todayISO`, `isValidISODate` in `src/lib/dates.ts`.
- **Phase 4 will:** add the subscription-status column/badge to the list and a subscriptions section on the detail page (both have placeholders); reuse `usePlayersList`-style patterns; the player picker for a new subscription should use the same RLS-scoped `players` query (a coach can only pick their own).
- **Phase 5 will:** fill the attendance placeholder; a session roster is "active players of the session's coach" (`players.coach_id`).
- **Gotchas:** the `players_guard` trigger forces `deleted_at = null` on INSERT (test fixtures remove a player with an UPDATE); PostgREST needs the relationship hint `coach:profiles!players_coach_id_fkey(full_name)` because three foreign keys point at `profiles`; a coach sees `coach: null` for embedded coaches other than themself (they only read their own profile, D-034); `assign_players` was added to `database.types.ts` by hand in the generator's format — regenerate when convenient; TanStack Query serves an unchanged filter set from cache for 30 s, so tests assert what the user sees rather than call counts after "clear filters"; `DataList` renders a table **and** cards, so browser selectors must pick visible elements.
- **Checking a request shape without a login:** call it as `anon` with supabase-js — a well-formed request ends in `42501 permission denied`, a malformed one in `PGRST200/202/…` (parsing/schema-cache error).
- **Not done (by design):** Arabic-Indic digits typed into CPR/phone are rejected with the normal validation message (Latin digits only, per `07-i18n.md`); a nicer option is to normalise them on input — worth doing if coaches hit it.
