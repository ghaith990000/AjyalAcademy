# Business rules

All amounts are **integer fils** (1 BD = 1000 fils). Examples show BD for readability. The subscription total is calculated in **two places that must agree**: `src/lib/pricing.ts` (live preview in the form) and SQL `calc_subscription_total` (authoritative, used by `create_subscription`). Both must be unit-tested against the worked examples below — if you change a rule, change both and this doc.

## Plans

| Plan | Players in subscription | Price (per month) |
| ---- | ----------------------- | ----------------- |
| Solo | 1                       | 20.000 BD         |
| Duo  | 2                       | 35.000 BD         |
| Trio | 3                       | 50.000 BD         |
| Quad | 4                       | 60.000 BD         |

- The plan is **derived from the number of players selected** (1–4). A subscription must contain exactly `plan.player_count` players.
- The price is for the **subscription period** (default one month). Plan prices are admin-editable; the price is **snapshotted** on the subscription so later edits never change history.
- Typical use: siblings/friends sharing one subscription. A coach can only add their own players; an admin can pick any players.

## Subscription period

- `start_date` is chosen (default: today). `end_date` defaults to `start_date + 1 month − 1 day` (inclusive), and is editable.
  - e.g. start 2026-10-01 → end 2026-10-31; start 2026-10-15 → end 2026-11-14.
- Status is computed from today's date `D`:
  - `cancelled` if `cancelled_at` is set; else `upcoming` if `D < start`; `expired` if `D > end`; else `active`.
  - `expiring_soon` = `active` and `end − D ≤ settings.expiring_soon_days` (default 7).
- A player cannot be in two non-cancelled subscriptions whose date ranges overlap (rejected with a translated error naming the players). Dates are inclusive: a subscription ending on the 31st and one starting on the 31st overlap; starting on the 1st does not.

## Fees

For each player in the subscription:

- **T-shirt fee** = `settings.tshirt_fee_fils` **only if this is the player's first-ever subscription** (no earlier row in `subscription_players` for them, cancelled or not — a cancelled first subscription does not re-trigger the fee). The UI pre-ticks it; an admin may untick/tick it. Otherwise 0.
- **Transport fee** = `settings.transport_fee_fils` if "needs transportation" is ticked for that player, else 0. Per player, per subscription.

Fee amounts are snapshotted on `subscription_players`.

_As built:_ the server decides the T-shirt fee. For a **coach** it is always automatic (first subscription ⇒ charged); an **admin** may explicitly waive or add it per player. The wizard reads whether a player is a first-timer from `subscription_players` (RLS-scoped, which is complete for the players a user may subscribe).

## Discounts

Two sources (one per subscription, not stackable — sending both is refused):

1. **Discount code** — an admin-defined row in `discounts` (`percent` or `fixed`, optional validity dates, optional `max_uses`, `active`). Entered by code (case-insensitive, trimmed); must be active, within its dates **today (academy date)** and under `max_uses` (cancelled subscriptions do not count as uses).
2. **Manual discount** — the user types a percent or fixed BD amount **and a reason** (reason required). Logged in the activity feed.

Calculation:

```
subtotal      = plan_price + Σ tshirt_fee + Σ transport_fee
discount_fils = percent : round(subtotal × bps / 10000)      # round half up to the nearest fil
                fixed   : value_fils
discount_fils = min(discount_fils, subtotal)                 # never negative total
total         = subtotal − discount_fils
```

The discount applies to the whole subtotal (including T-shirt and transport). If the owner decides otherwise, change it in `calcSubscriptionTotal` + SQL and record the change in [08-decisions.md](08-decisions.md).

### Worked examples (use these as unit-test fixtures)

| #   | Scenario                                                                                                      | Subtotal (fils) | Discount (fils) | Total (fils) |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------- | --------------- | ------------ |
| 1   | Solo, returning player, no transport, no discount                                                             | 20000           | 0               | **20000**    |
| 2   | Solo, first-time player (T-shirt 5000), no transport                                                          | 25000           | 0               | **25000**    |
| 3   | Duo (35000); player A first-time (T-shirt 5000) + transport 10000; player B returning, no transport; 10% code | 50000           | 5000            | **45000**    |
| 4   | Solo (20000) + T-shirt 5000, fixed discount 3000                                                              | 25000           | 3000            | **22000**    |
| 5   | Solo (20000), fixed discount 30000 (larger than subtotal)                                                     | 20000           | 20000 (capped)  | **0**        |
| 6   | Quad (60000), all returning, 2 players use transport (2 × 10000), 15% manual discount                         | 80000           | 12000           | **68000**    |
| 7   | Rounding: Solo (20000) + transport 10000 + T-shirt 5000 = 35000, 12.5% (bps 1250) → 4375                      | 35000           | 4375            | **30625**    |

_Fee values above assume the **placeholder** settings: T-shirt 5000 fils, transport 10000 fils. Tests must pass the fee values explicitly, not read the seed._

## Payments and "collected"

- A `payment` is money actually received. `paid_fils = Σ payments`; `balance_fils = total_fils − paid_fils` (never negative; overpayment is rejected).
- `create_subscription` accepts an optional initial payment; the UI defaults to **"paid in full today"** (creates a payment for `total_fils`, method cash by default). It can be unticked to leave the subscription unpaid, and further payments added later.
- **Collected fees** for a period = `Σ payments.amount_fils` where `paid_at` is in that period (not subscription totals, not start dates).
- A fully discounted (total 0) subscription creates no payment.
- A payment cannot be dated in the future, must be above zero, and cannot take `paid` above `total`. A cancelled subscription accepts no payments.
- Cancelling a subscription does **not** delete or refund payments; refunds are out of scope (record a negative adjustment as an `other` expense if needed).

## Expenses and reports

Expense categories: `coach_salary`, `field_rent`, `transportation`, `equipment`, `other`. Expenses are attributed to the period of `expense_date`.

- **Monthly salaries:** the "Generate monthly salaries" action (month picker) inserts one `coach_salary` expense per **active** coach with `monthly_salary_fils > 0`, dated the 1st of the month, and is **idempotent** (skips coaches already having a salary expense that month).

For a period (a calendar month, or a calendar year):

```
collected  = Σ payments.amount_fils        (paid_at in period)
expenses   = Σ expenses.amount_fils        (expense_date in period)
profit     = collected − expenses
margin     = profit / collected × 100 %    (shown as "—" when collected = 0)
```

Example — October: collected 540.000 BD, expenses 210.000 (salaries 150 + field rent 50 + transportation 10) → profit 330.000, margin 61.11 %. Negative profit/margin are shown in the danger color.

Reports also show: collected per month (12 bars for a year), expenses by category, and CSV export of the period's payments and expenses.

## Player rules

- **CPR:** exactly 9 digits, unique among non-removed players; a duplicate is blocked, with a link to the existing player when the user is allowed to see it (D-043).
- **Disease:** `has_disease = true` ⇒ description required; `false` ⇒ description cleared.
- **Removal is soft:** the player disappears from lists and rosters; subscriptions/payments/attendance history are kept; the removal is logged with who did it.
- **Ownership:** a coach who creates a player is automatically their coach. Only an admin can reassign (single or bulk). A player can have **one** coach.
- **Roster for a session** = active (non-removed) players whose `coach_id` equals the session's coach. Players without an active subscription are flagged with a warning badge but can still be marked. "Active subscription" is judged on the **session's own date**: a non-cancelled subscription whose (inclusive) period covers that day (D-057).

## Sessions and attendance

- A session has a date, a start and an end time (`end > start`), one **coach** (an active coach; a coach schedules only for themself, an admin picks), an optional location and notes. "Repeat weekly" creates 2–26 sessions a week apart, the first included. A clash with the same coach's other non-cancelled sessions (same day, overlapping times; touching ends do not clash) is a **warning**, never a block.
- Session status: **cancelled** (final), else **done** once its end time has passed, else **upcoming**. The agenda's default filter "Today & upcoming" shows everything not cancelled from today on, whatever the time, so a session that has just ended can still be marked (D-058).
- Attendance is **present / absent** only (D-023). The screen starts everyone absent; saving records the whole roster and can be repeated to correct marks. **Attendance can be taken from the session's day on** (D-062): a cancelled session or one dated after today (academy date) cannot be marked — the database refuses it and the screens don't offer it. Only the session's coach or an admin can save.
- **Attendance rate** (player page) = sessions marked present ÷ sessions with a mark, as a whole percent (half up); "—" when there is nothing to divide; cancelled sessions are not counted (D-059).

## Activity feed rules

Logged actions and who can see them are listed in [04-data-model.md](04-data-model.md#activity_log). Admin sees all; a coach sees only their own actions. Entries are immutable and store a snapshot so deleted entities still render meaningfully.
