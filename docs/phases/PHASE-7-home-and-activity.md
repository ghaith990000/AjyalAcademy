# Phase 7 — Home dashboards & activity feed

**Status:** Done — automated and browser checks complete; owner's live check pending (the live update over the real Realtime connection especially) · **Requirements:** R-11 (UI), plus polish of R-15

## Goal

Make the home screen the daily control panel: KPIs, today's sessions, expiring subscriptions, and a live **activity feed** showing who added/removed players, created subscriptions, etc.

## Read first

[04-data-model.md](../04-data-model.md#activity_log) (actions list, visibility), [05-business-rules.md](../05-business-rules.md#activity-feed-rules), [06-design-system.md](../06-design-system.md) (hero card, StatCard)

## Tasks

- [x] `features/activity`: `useActivityFeed` (newest first, cursor paging, 15 a time) + a Supabase **Realtime** channel on `activity_log` INSERTs that refetches the feed and the home data (D-070)
- [x] `ActivityItem` renderer: actor avatar with an action icon, a translated sentence per action built from the `summary` snapshot ("Khalid added the player Yousef to the team of …"), a detail line where it helps (balance left / paid in full, cancel reason), relative time (`5 minutes ago` / `قبل 5 دقائق`, Latin digits) that keeps counting; filter chips by kind (players / subscriptions / payments / sessions / expenses / other); "Show more"
- [x] i18n `activity` namespace: one sentence per action in [04-data-model.md](../04-data-model.md#activity_log) — all 16 the app writes — in AR + EN; an unknown action falls back to a generic sentence, a missing value to a word or "—"
- [x] **Admin home:** hero (greeting, date), KPI cards (active players, active subscriptions, collected this month, net profit this month with its margin), today's sessions, **expiring soon** subscriptions (unpaid balance flagged), the **live feed** (everyone)
- [x] **Coach home:** greeting, my players count, today's sessions count and list with a one-tap "Take attendance", my expiring subscriptions, and **my recent activity** (RLS-scoped)
- [x] Quick actions (Add player, New subscription, Schedule session) as three thumb-reachable tiles; add player and schedule open their forms in place
- [x] Empty / loading / error states; skeletons for the KPIs, sessions, expiring list and feed; one card failing never blanks the others
- [x] Tests (Vitest: 609 in total): the sentence of **every action in both languages** (pinned word for word), fallbacks and malformed snapshots, the feed (filters by role, paging by cursor, states, live badge), the cursor query, the Realtime hook, the home page for both roles (numbers, red loss, sessions, expiring, quick actions, failures), relative time, `StatCard`, `FilterChips`

## Acceptance criteria — results

- [x] **A new entry appears on the admin home within ~2 seconds without a refresh, naming the actor and the player** — in Chrome, over a mocked Realtime WebSocket that speaks the real protocol (phoenix v2 frames, `postgres_changes` with the binding ids): the pushed `player.created` showed at the top in under 2s (asserted) in all eight role × language × viewport runs, said "now", named the actor and the player, and refreshed the numbers on the same screen. Not yet seen against the real Realtime service (Claude has no login) — see the owner's check below. The database side is confirmed: `activity_log` is in the `supabase_realtime` publication with an authenticated-only select policy.
- [x] **A coach's home shows only their own activity** — RLS (`actor_id = auth.uid()`, pgTAP from Phase 2) is the boundary; the coach's feed has no expenses / other chips, in the browser check the coach's feed lists only the entries of their own (and their own live entry appears). Another user's entry never reaching a coach is the database's job and stays covered by the Phase 2 policy tests — the mocked Realtime server cannot show it.
- [x] **KPIs match the Reports numbers for the current month** — the home calls the same hook with the same range (asserted in a test and in the browser: 540.000 / 330.000 / 61.11%), so they share one cache entry.
- [x] Home is polished and usable at 390px and 1280px in Arabic and English — 400 checks in Chrome with mocked API responses: no horizontal scroll, tap targets ≥ 44px, KPIs 2 × 2 on a phone and 4 across on desktop with no clipped values, no clipped sentence, dialogs inside the viewport, no console errors — plus a look at the screenshots, which found and fixed: KPI cards too tall on a phone and `540.000 BD` wrapping on desktop (`StatCard compact`), seven wrapped chips taking three rows (scrolling chips), a page-wide sideways scroll caused by the scrolling chips in a grid, and an invalid `<div>` inside a `<p>` in `StatCard`.
- [x] Every new request shape checked against the hosted project as `anon` (8 accepted by PostgREST → "permission denied", including the cursor with `+` encoded as the client does; 4 deliberately wrong controls fail at parsing with `42703` / `PGRST100` / `PGRST200`).
- [x] `typecheck`, `lint`, `test` (609), `build` pass; docs updated (`02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`); no migration was needed.
- [ ] **Owner's live check** with the real accounts: open the admin home in one browser and add a player as a coach in another — the entry should appear within a couple of seconds; check the "Live" badge shows; check a coach's feed shows only their own actions.

## Out of scope

Notifications/push, editing or deleting activity entries.

## Handoff notes

- **Where things are:** `src/features/activity` (`activity.ts` holds every rule about what an entry says), `src/features/home`; `useTodaySessions` in the sessions feature; `formatTimeAgo` / `formatRelative` in `lib/dates.ts`; `useNow`; `FilterChips` and `StatCard compact` in `components/ui`; fixtures `src/test/activity.ts`. Architecture: `03-architecture.md` → "As built (Phase 7)"; rules: `05-business-rules.md` → "Home screen"; sentence conventions: `07-i18n.md`.
- **Decisions to confirm with the owner** (D-069…D-073): what "active players" and "active subscriptions" mean on the home; the chip groups; that a coach's home has no money figures. Nothing needed a new open question.
- **Adding an action later:** add it to `LOOKS` in `activity.ts` (icon and tone), give it a sentence under `activity:action.<entity>.<verb>` in both languages, add a `describeActivity` case and a sample in `src/test/activity.ts` — the "every action" tests then cover it. Until then it shows as "made a change".
- **Gotchas:** React Query refetches an infinite query's pages one after another, taking each next cursor from the fresh page before it, so a live insert cannot leave a gap or a duplicate; a `Trans` sentence needs its tags mapped in `ActivityItem` (`b`, `m`, `d`); a grid item that scrolls sideways needs `min-w-0` / a `minmax(0, 1fr)` track; component tests that render the home must mock its APIs (the app-shell tests stub `HomePage`); in the browser harness a `%2B`-less `+` in a hand-written URL becomes a space (the real client encodes it), and a mock that returns the boundary row twice makes React keep stale rows — assert on duplicates explicitly; the harness mocks Realtime with `page.routeWebSocket` and phoenix v2 array frames (`[join_ref, ref, topic, event, payload]`).
- **Known limits (by design):** the feed only listens while the home screen is open (it refetches on return); "this month" and "today" use the browser's date (D-047); an older entry whose snapshot lacks a field reads with a dash or a fallback word rather than failing; there is no separate "all activity" page — "Show more" pages back as far as needed.
- **Pre-existing, not touched:** the phone link on the player page is an 18px tap target (Phase 3); the Arabic placeholder in an empty `dir="auto"` input aligns left; the main bundle is ~1.14 MB (the reports page is its own chunk) and needs more code-splitting in Phase 8.
