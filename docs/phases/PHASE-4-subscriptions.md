# Phase 4 — Subscriptions, fees, discounts & payments

**Status:** Done — automated and browser checks complete; owner's live check pending · **Requirements:** R-02, R-10, R-12

## Goal

Subscribe players under Solo/Duo/Trio/Quad plans with T-shirt and transport fees, discounts (codes and manual), and payments with balances.

## Read first

[05-business-rules.md](../05-business-rules.md) (**all of it** — formulas and worked examples), [04-data-model.md](../04-data-model.md) (`subscriptions`, `subscription_players`, `discounts`, `payments`, RPCs), [08-decisions.md](../08-decisions.md) (Q-001…Q-004 — ask the owner or confirm placeholders)

## Tasks

- [x] `src/lib/pricing.ts`: `calcSubscriptionTotal` (fils in/out, half-up rounding, never negative) + unit tests using **all seven worked examples**; `src/lib/dates.ts`: `defaultEndDate` (+1 month − 1 day); `src/lib/subscription-status.ts` (`upcoming/active/expiring_soon/expired/cancelled`)
- [x] SQL `calc_subscription_total` + `create_subscription` fully implemented and **tested against the same examples** (`supabase/tests/database/04_subscriptions.test.sql`): overlap rule (inclusive dates, cancelled ones ignored), player-count → plan, discount validation (active / dates / `max_uses`, cancelled uses free the code), first-time T-shirt detection (cancelled first subscription does not re-trigger it), optional initial payment, activity log entries. Migration `20260919100600_subscriptions.sql`
- [x] `record_payment` (overpayment / future-date / cancelled guards) and `cancel_subscription` (reason required, payments kept) implemented + tested
- [x] **Settings page (admin):** plan prices, T-shirt fee, transport fee, expiring-soon days
- [x] **Discounts page (admin):** list with value, validity, usage count, status; add/edit dialog (name, code, percent/fixed, validity, max uses, active)
- [x] **New subscription wizard** (six steps: players → period → per-player options → discount → summary → payment) with the plan chosen automatically from the number of players (1–4), live total, T-shirt pre-ticked for first-timers (an admin may change it), transport, code or manual discount with reason, paid in full / part / unpaid + method. Can be started from a player (`?player=`)
- [x] **Subscriptions list:** filter by status (incl. expiring soon), search by player, players / plan / period / total / paid / balance / status, "Show more" paging; **detail page** with breakdown, payments, "Add payment", "Cancel subscription" (confirm + reason)
- [x] Player detail shows subscription history with a "New subscription" shortcut; Players list badge uses the real status (`player_subscription_status`)
- [x] i18n `subscriptions`, `discounts`, `settings` (AR + EN)
- [x] Component tests: plan auto-selection, live totals, discount modes and their errors, disabled states, payment/cancel dialogs, list filters, settings and discounts forms (Vitest: 318 tests in total)

## Acceptance criteria — results

- [x] Solo/Duo/Trio/Quad totals equal the worked examples — both the TypeScript preview (Vitest) and the stored `total_fils` (pgTAP calls the real `create_subscription` for examples #2–#7 and `calc_subscription_total` for #1–#7 plus rounding).
- [x] First-time player: T-shirt fee pre-ticked; a returning player: none; a cancelled first subscription does not re-trigger it (pgTAP + wizard tests). A coach cannot waive it; an admin can.
- [x] Overlapping subscription for the same player is rejected (`23P01`), naming the players in the translated message and returning the user to the dates step. The last day is inclusive; the next day is allowed.
- [x] Discount codes: expired / not started / inactive / exhausted / unknown are refused; a manual discount needs a reason; a discount is capped at the subtotal so the total is never negative; a code and a manual discount cannot be combined.
- [x] Payments update paid/balance; overpayment, zero, negative, future-dated and cancelled-subscription payments are refused; `subscription.created`, `payment.recorded` and `subscription.cancelled` are logged with the right actor and a snapshot.
- [x] A coach cannot use another coach's player or see/pay/cancel a subscription with none of theirs; in a mixed subscription they see only their own players' names (pgTAP, 121 assertions on the hosted project; total 274 pgTAP assertions).
- [x] Creation is all-or-nothing: a refused create (e.g. overpayment) leaves no subscription, fees or log rows.
- [x] 390px and desktop, Arabic and English: no horizontal scroll on the list, wizard (all six steps), detail, payment and cancel dialogs, discounts and settings; dialogs fit the viewport; tap targets ≥ 44px; amounts are LTR inputs; long Arabic names wrap; no console errors — 96 checks in Chrome with mocked API responses (Claude has no login), plus a look at the screenshots.
- [x] Every new request shape checked against the hosted project as `anon` (accepted by PostgREST → "permission denied"; two deliberately wrong controls fail at parsing).
- [x] `typecheck`, `lint`, `test` (318), `build` pass; advisors: only the intentional SECURITY DEFINER notes; docs updated (`03`, `04`, `05`, `06`, `07`, `08`).
- [ ] **Owner's live check** with the real accounts (testing guide given with the commit).

## Out of scope

Reports (Phase 6), refunds, payment gateways.

## Handoff notes

- **Where things are:** SQL `supabase/migrations/20260919100600_subscriptions.sql` (+ `04_subscriptions.test.sql`); TS `src/lib/pricing.ts`, `subscription-status.ts`, `discounts.ts`; `src/features/subscriptions` (`draft.ts` holds the wizard's rules), `src/features/settings`, `src/features/discounts`; fixtures `src/test/subscriptions.ts`. Architecture notes: `03-architecture.md` → "As built (Phase 4)"; SQL contract: `04-data-model.md` → "As built (Phase 4)".
- **Decisions to confirm with the owner** (D-046…D-054, Q-001…Q-004, Q-009): fee amounts (currently 5.000 / 10.000 BD per player), coaches creating subscriptions/payments and giving manual discounts, discount base (whole subtotal). All amounts are editable in Settings.
- **Phase 5 (attendance):** the roster warning badge ("no active subscription") can use `player_subscription_status` (missing row, `expired` or `upcoming` ⇒ warn). **Phase 6 (reports):** "collected" = `payments` by `paid_at`; unpaid balances are `subscription_overview.balance_fils` (exclude `status = 'cancelled'`); revenue/expense RPCs should also use `today_bh()` for "this month".
- **Gotchas:** `subscription_overview` was created with `s.*`, so adding a column to `subscriptions` needs the view recreated; `today_bh()` (Asia/Bahrain) is the academy's "today" in SQL while the browser uses its own local date (D-047); PostgREST filters/embeds on a view need no relationship hints, but embeds from tables do (`profiles!payments_received_by_fkey`); the wizard's "returning player" lookup is deliberately not required on steps 1–2; `database.types.ts` gained the two views and three functions by hand in the generator's format — regenerate when convenient; a `DataList` renders both a table and cards, so browser selectors must pick visible elements; Playwright runs started right after saving a file can fail once while the dev server hot-reloads — re-run.
- **Not built (by design):** editing a saved subscription's dates/players (cancel and recreate), refunds, payment deletion, per-plan discount rules. The subscriptions list sorts newest first only.
- **Housekeeping for Phase 8:** Supabase Auth's "leaked password protection" is off (a dashboard setting, may need a paid plan); unindexed audit-column foreign keys are INFO-level advisor notes; the bundle (~940 kB) still needs code-splitting.
