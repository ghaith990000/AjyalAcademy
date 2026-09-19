# Phase 7 — Home dashboards & activity feed

**Status:** Not started · **Requirements:** R-11 (UI), plus polish of R-15

## Goal

Make the home screen the daily control panel: KPIs, today's sessions, expiring subscriptions, and a live **activity feed** showing who added/removed players, created subscriptions, etc.

## Read first

[04-data-model.md](../04-data-model.md#activity_log) (actions list, visibility), [05-business-rules.md](../05-business-rules.md#activity-feed-rules), [06-design-system.md](../06-design-system.md) (hero card, StatCard)

## Tasks

- [ ] `features/activity`: `useActivity` (paginated, newest first) + Supabase **Realtime** subscription on `activity_log` that prepends new entries / invalidates the query
- [ ] `ActivityItem` renderer: actor avatar/name, translated sentence per action using the `summary` snapshot (e.g. "Coach Ali added player Yousef"), relative time ("5 min ago" / "منذ ٥ دقائق" style but Latin digits), icon per action type; filter chips by entity (players / subscriptions / payments / sessions / …); "Load more"
- [ ] i18n `activity` namespace: one sentence key per action in [04-data-model.md](../04-data-model.md#activity_log) (AR + EN); unknown action falls back to a generic sentence
- [ ] **Admin home:** hero card (greeting, date), KPI `StatCard`s (active players, active subscriptions, collected this month, net profit this month), today's sessions, **expiring soon** subscriptions (with unpaid balances flagged), and the **live activity feed** (all users)
- [ ] **Coach home:** greeting, my players count, today's sessions with a one-tap "Take attendance" button, my expiring subscriptions, and **my recent activity** (RLS-scoped)
- [ ] Quick actions (Add player, New subscription, Schedule session) as thumb-reachable buttons on mobile
- [ ] Empty/loading/error states; skeletons for KPIs and feed
- [ ] Tests: activity sentence rendering for every action in both languages, role-based home content

## Acceptance criteria

- Adding a player, removing a player, or creating a subscription as a coach makes a new entry appear on the **admin** home feed within ~2 seconds without refresh, naming the actor and the player/plan.
- A coach's home shows only their own activity.
- KPIs match the Reports numbers for the current month (same RPCs).
- Home is polished and usable at 390px in AR and EN; docs updated; all checks pass.

## Out of scope

Notifications/push, editing or deleting activity entries.

## Handoff notes

_(fill in when done)_
