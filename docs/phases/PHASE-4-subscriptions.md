# Phase 4 — Subscriptions, fees, discounts & payments

**Status:** Not started · **Requirements:** R-02, R-10, R-12

## Goal

Subscribe players under Solo/Duo/Trio/Quad plans with T-shirt and transport fees, discounts (codes and manual), and payments with balances.

## Read first

[05-business-rules.md](../05-business-rules.md) (**all of it** — formulas and worked examples), [04-data-model.md](../04-data-model.md) (`subscriptions`, `subscription_players`, `discounts`, `payments`, RPCs), [08-decisions.md](../08-decisions.md) (Q-001…Q-004 — ask the owner or confirm placeholders)

## Tasks

- [ ] `src/lib/pricing.ts`: `calcSubscriptionTotal` (fils in/out) + **unit tests using every worked example** in 05-business-rules; `src/lib/dates.ts`: default end date (+1 month − 1 day), status derivation (`upcoming/active/expiring_soon/expired/cancelled`)
- [ ] SQL `calc_subscription_total` + `create_subscription` fully implemented and **tested against the same examples** (`supabase/tests/`); overlap rule, player-count rule, discount validation (active/dates/max_uses), first-time T-shirt detection, optional initial payment, activity log entries
- [ ] `record_payment` (overpayment guard) and `cancel_subscription` RPCs implemented + tests
- [ ] **Settings page (admin):** edit plan prices, T-shirt fee, transport fee, expiring-soon days
- [ ] **Discounts page (admin):** CRUD for codes (name, code, percent/fixed, validity, max uses, active), usage count
- [ ] **New subscription flow** (mobile-friendly stepper): 1) pick players (coach: own only; admin: any; selecting 1–4 sets the plan automatically, with the plan card showing the price) → 2) dates (defaults) → 3) per-player options: T-shirt (pre-ticked if first time; admin can toggle) and transport → 4) discount: none / code / manual (+ reason) → 5) summary with live line-item breakdown and total → 6) payment: paid in full (default) / partial / unpaid, method
- [ ] **Subscriptions list:** filter by status (incl. expiring soon), search by player, shows players, period, total, paid, balance, status badge; **detail page** with breakdown, payments list, "Add payment", "Cancel subscription" (confirm + reason)
- [ ] Player detail: show subscription history and current status; Players list badge uses real status
- [ ] i18n `subscriptions`, `discounts`, `settings` namespaces (AR + EN)
- [ ] Component tests: plan auto-selection, live total updates, discount modes, disabled states

## Acceptance criteria

- Creating Solo/Duo/Trio/Quad subscriptions yields exactly the totals in the worked examples (UI preview **and** stored `total_fils`).
- First-time player gets the T-shirt fee pre-ticked; a returning player does not; cancelled first subscription does not re-trigger it.
- Overlapping subscription for the same player is rejected with a translated message.
- Discount code validity (expired/inactive/max-uses) enforced; manual discount requires a reason; discount can never make total negative.
- Payment updates paid/balance; overpayment rejected; all steps logged (`subscription.created`, `payment.recorded`, `subscription.cancelled`).
- Coach cannot see or create subscriptions involving other coaches' players. Flow is usable at 390px in AR and EN.

## Out of scope

Reports (Phase 6), refunds, payment gateways.

## Handoff notes

_(fill in when done: final fee values chosen by owner, any rule changes → also update 05-business-rules.md)_
