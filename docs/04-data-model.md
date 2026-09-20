# Data model (Postgres / Supabase)

Status: **migrated in Phase 2; extended in Phase 9 (locations)** — tables, constraints, RLS, guard/activity triggers and `remove_player` exist (`supabase/migrations/`). Other RPCs are implemented in the phase that uses them (see the RPC table). This doc is the contract; migrations must match it. Update both together.

## Conventions

- Primary keys: `uuid` default `gen_random_uuid()`. Every table has `created_at timestamptz default now()`.
- **Money = integer fils** in columns named `*_fils` (1 BD = 1000 fils). Never `numeric`/`float` money.
- Percent discounts are stored as **basis points** (10% = `1000`); fixed discounts as fils. See [05-business-rules.md](05-business-rules.md).
- Soft delete: `players.deleted_at`, `subscriptions.cancelled_at`. Queries exclude soft-deleted rows by default; financial reports still include their payments.
- Dates are `date`; times are `time`; timestamps are `timestamptz`.
- Enums are Postgres enums (listed below). Translate labels in the UI, never store Arabic/English text in enum values.
- `auth.uid()` is the acting user everywhere. Helper SQL functions (SECURITY DEFINER, `search_path = ''`): `is_active_user()`, `is_admin()`, `current_user_role()` (D-035), `owns_player(player_id)`, `can_view_subscription(id)`, `can_view_session(id)`. `anon`, `authenticated` and `PUBLIC` have **no default privileges** — every migration grants explicitly (D-036).

## Enums

| Enum                | Values                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `user_role`         | `admin`, `coach`                                                     |
| `discount_type`     | `percent`, `fixed`                                                   |
| `payment_method`    | `cash`, `benefit`, `bank_transfer`, `other`                          |
| `attendance_status` | `present`, `absent`                                                  |
| `expense_category`  | `coach_salary`, `field_rent`, `transportation`, `equipment`, `other` |

## Tables

### `profiles` (1:1 with `auth.users`)

| Column                | Type          | Notes                                               |
| --------------------- | ------------- | --------------------------------------------------- |
| `id`                  | uuid PK       | = `auth.users.id`                                   |
| `full_name`           | text not null |                                                     |
| `email`               | text not null | copy of the login email; read-only in the UI        |
| `role`                | user_role     | not null                                            |
| `phone`               | text          |                                                     |
| `monthly_salary_fils` | int           | default 0; used by "generate monthly salaries"      |
| `active`              | bool          | default true; inactive users cannot log in usefully |
| `preferred_language`  | text          | `ar` \| `en`, default `ar`                          |

### `players`

| Column                | Type             | Notes                                                                                                 |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `full_name`           | text not null    |                                                                                                       |
| `cpr`                 | text not null    | **unique** (among non-deleted), check `^[0-9]{9}$`                                                    |
| `date_of_birth`       | date not null    | must be in the past                                                                                   |
| `address`             | text             |                                                                                                       |
| `school`              | text             |                                                                                                       |
| `phone`               | text not null    | guardian/contact number                                                                               |
| `has_disease`         | bool not null    | default false                                                                                         |
| `disease_description` | text             | **check:** required (non-empty) when `has_disease`, null when not                                     |
| `coach_id`            | uuid → profiles  | nullable (unassigned); admin assigns; coach-created ⇒ that coach                                      |
| `location_id`         | uuid → locations | optional label: where the player trains; must be an **active** location when set or changed (Phase 9) |
| `created_by`          | uuid → profiles  |                                                                                                       |
| `deleted_at`          | timestamptz      | soft delete; `deleted_by uuid` also stored                                                            |

Indexes: `(coach_id) where deleted_at is null`, trigram/`ilike` search on `full_name`, unique partial index on `cpr where deleted_at is null`.

### `locations` (Phase 9)

| Column    | Type | Notes                                                                          |
| --------- | ---- | ------------------------------------------------------------------------------ |
| `name`    | text | 1–120 characters, **unique** ignoring case and surrounding spaces              |
| `address` | text | optional, ≤ 200 characters                                                     |
| `active`  | bool | default true; switched off instead of deleted — history keeps the name (D-084) |

Every signed-in active user may read (inactive ones too); only admins insert or update (column grants: `name`, `address`, `active`); there is no delete. Insert / change is logged (`location.created` / `location.updated`).

### `plans` (seeded, admin-editable prices)

| Column         | Type         | Notes                               |
| -------------- | ------------ | ----------------------------------- |
| `code`         | text unique  | `solo`, `duo`, `trio`, `quad`       |
| `player_count` | int (1–4)    | unique                              |
| `price_fils`   | int not null | seed: 20000 / 35000 / 50000 / 60000 |
| `active`       | bool         |                                     |

### `settings` (single row)

| Column               | Type | Notes                                                             |
| -------------------- | ---- | ----------------------------------------------------------------- |
| `tshirt_fee_fils`    | int  | default **placeholder 5000** — confirm with owner (see decisions) |
| `transport_fee_fils` | int  | default **placeholder 10000** — confirm with owner                |
| `expiring_soon_days` | int  | default 7                                                         |

### `subscriptions`

| Column                          | Type               | Notes                                                                                                                               |
| ------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `plan_id`                       | uuid → plans       |                                                                                                                                     |
| `start_date`                    | date not null      |                                                                                                                                     |
| `end_date`                      | date not null      | inclusive; check `end_date >= start_date`                                                                                           |
| `plan_price_fils`               | int not null       | **snapshot** of plan price at creation                                                                                              |
| `tshirt_total_fils`             | int not null       | sum of `subscription_players.tshirt_fee_fils`                                                                                       |
| `transport_total_fils`          | int not null       | sum of `subscription_players.transport_fee_fils`                                                                                    |
| `discount_id`                   | uuid → discounts   | nullable (null for manual or none)                                                                                                  |
| `discount_type`                 | discount_type      | nullable (snapshot)                                                                                                                 |
| `discount_value`                | int                | nullable; bps for percent, fils for fixed                                                                                           |
| `discount_reason`               | text               | required when a manual discount is used                                                                                             |
| `discount_fils`                 | int not null       | default 0; the computed discount amount                                                                                             |
| `total_fils`                    | int not null       | `plan_price + tshirt + transport − discount`, server-computed                                                                       |
| `cancelled_at` / `cancelled_by` | timestamptz / uuid | soft cancel                                                                                                                         |
| `location_id`                   | uuid → locations   | where the subscription's money counts; **required for new subscriptions**, null on older ones until an admin sets it (D-085, D-086) |
| `created_by`                    | uuid → profiles    |                                                                                                                                     |

Derived status (view/computed in SQL and TS): `upcoming`, `active`, `expiring_soon`, `expired`, `cancelled`, plus `paid_fils` and `balance_fils`.

### `subscription_players`

| Column               | Type                                   | Notes                                            |
| -------------------- | -------------------------------------- | ------------------------------------------------ |
| `subscription_id`    | uuid → subscriptions on delete cascade |                                                  |
| `player_id`          | uuid → players                         | PK is `(subscription_id, player_id)`             |
| `tshirt_fee_fils`    | int not null                           | 0 unless first-time (or admin-forced) — snapshot |
| `transport_fee_fils` | int not null                           | 0 unless the player uses transport — snapshot    |

Rules (enforced in `create_subscription` RPC): row count = `plans.player_count`; a player cannot be in two non-cancelled subscriptions with overlapping dates.

### `discounts`

| Column                  | Type          | Notes                                                  |
| ----------------------- | ------------- | ------------------------------------------------------ |
| `name`                  | text not null |                                                        |
| `code`                  | text unique   | case-insensitive; entered when creating a subscription |
| `type`                  | discount_type |                                                        |
| `value`                 | int not null  | bps (percent, 1–10000) or fils (fixed, > 0)            |
| `valid_from`/`valid_to` | date          | nullable                                               |
| `max_uses`              | int           | nullable                                               |
| `active`                | bool          | default true                                           |

### `payments`

| Column            | Type                 | Notes                                        |
| ----------------- | -------------------- | -------------------------------------------- |
| `subscription_id` | uuid → subscriptions |                                              |
| `amount_fils`     | int (> 0)            | must not push `paid` above `total_fils`      |
| `paid_at`         | date not null        | the date used for monthly/yearly "collected" |
| `method`          | payment_method       |                                              |
| `note`            | text                 |                                              |
| `received_by`     | uuid → profiles      |                                              |

### `training_sessions`

| Column         | Type             | Notes                                                                                                                 |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `session_date` | date not null    |                                                                                                                       |
| `start_time`   | time not null    |                                                                                                                       |
| `end_time`     | time not null    | check `end_time > start_time`                                                                                         |
| `coach_id`     | uuid → profiles  | who runs it; its roster = that coach's active players                                                                 |
| `location_id`  | uuid → locations | required for new sessions, and an **active** location (the old free-text `location` was migrated and dropped — D-086) |
| `notes`        | text             |                                                                                                                       |
| `cancelled_at` | timestamptz      |                                                                                                                       |
| `created_by`   | uuid → profiles  |                                                                                                                       |

### `attendance`

| Column       | Type                                       | Notes                        |
| ------------ | ------------------------------------------ | ---------------------------- |
| `session_id` | uuid → training_sessions on delete cascade |                              |
| `player_id`  | uuid → players                             | PK `(session_id, player_id)` |
| `status`     | attendance_status                          |                              |
| `marked_by`  | uuid → profiles                            |                              |
| `marked_at`  | timestamptz                                |                              |

### `expenses`

| Column         | Type             | Notes                                                                 |
| -------------- | ---------------- | --------------------------------------------------------------------- |
| `category`     | expense_category |                                                                       |
| `amount_fils`  | int (> 0)        |                                                                       |
| `expense_date` | date not null    | date used for monthly/yearly expenses                                 |
| `coach_id`     | uuid → profiles  | only for `coach_salary`                                               |
| `description`  | text             |                                                                       |
| `location_id`  | uuid → locations | optional: none = academy-wide; an active location when set or changed |
| `created_by`   | uuid → profiles  |                                                                       |

### `activity_log`

| Column        | Type            | Notes                                                                                                    |
| ------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `actor_id`    | uuid → profiles | who did it                                                                                               |
| `action`      | text            | dotted key, see list below                                                                               |
| `entity_type` | text            | `player`, `subscription`, `payment`, `session`, `attendance`, `discount`, `expense`, `coach`, `location` |
| `entity_id`   | uuid            |                                                                                                          |
| `summary`     | jsonb           | **snapshot** for display (e.g. `{ "player_name": "Ali", "plan": "duo" }`) so removed rows still render   |
| `created_at`  | timestamptz     | indexed desc; table is in the `supabase_realtime` publication                                            |

Actions: `player.created`, `player.updated`, `player.removed`, `player.reassigned`, `subscription.created`, `subscription.cancelled`, `payment.recorded`, `discount.created`, `session.created`, `session.cancelled`, `attendance.saved`, `expense.created`, `expense.updated`, `expense.deleted`, `expense.salaries_generated`, `coach.created`, `location.created`, `location.updated`, `subscription.location_changed`. UI maps each to a translated sentence with the `summary` values.

## RPCs and SQL functions

| Function                                     | Who                        | Purpose                                                                                                                                                        |
| -------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calc_subscription_total(...)`               | internal                   | Authoritative total calculation (mirrors `src/lib/pricing.ts`).                                                                                                |
| `create_subscription(...)`                   | admin, coach (own players) | Validates (incl. a **required active location**, Phase 9), recomputes fees/discount/total, inserts subscription + players (+ optional payment), logs activity. |
| `set_subscription_location(id, location)`    | admin                      | Labels an older subscription or corrects one; moves all its payments to that location; logged with both names (Phase 9).                                       |
| `record_payment(subscription_id, ...)`       | admin, coach (own)         | Adds a payment, guards overpayment, logs activity.                                                                                                             |
| `cancel_subscription(id, reason)`            | admin, coach (own)         | Sets `cancelled_at`, logs activity.                                                                                                                            |
| `save_attendance(session_id, records)`       | admin, session coach       | Upserts attendance rows (records = JSON array), logs one `attendance.saved`.                                                                                   |
| `assign_players(player_ids[], coach_id)`     | admin                      | Bulk (re)assignment, logs `player.reassigned`.                                                                                                                 |
| `generate_monthly_salaries(month date)`      | admin                      | Idempotently inserts a `coach_salary` expense per active coach with a salary (created / skipped counts).                                                       |
| `report_summary(from, to[, location])`       | admin                      | `{ collected_fils, expenses_fils, profit_fils, margin_bps }`; with a location, only its payments and expenses.                                                 |
| `revenue_by_month(year[, location])`         | admin                      | 12 rows: `month_start`, collected, expenses, profit.                                                                                                           |
| `expenses_by_category(from, to[, location])` | admin                      | category, total.                                                                                                                                               |
| `report_by_location(from, to)`               | admin                      | One row per location that is active or has money in the period, plus a `null` location_id row (Phase 9).                                                       |

### As built (Phase 4)

- `create_subscription(p_start_date, p_end_date, p_players jsonb, p_discount_code, p_manual_discount_type, p_manual_discount_value, p_manual_discount_reason, p_initial_payment_fils, p_payment_method, p_payment_note) → uuid` — `p_players` = `[{player_id, transport?, tshirt?}]` (1–4; the `tshirt` override is honoured for admins only). Checks, in order: caller active → players (own for a coach, not removed) → dates → plan for the count (active) → **overlap** (`23P01`, DETAIL = conflicting player ids; the end date is inclusive) → fees → discount (code **or** manual, not both) → totals (`calc_subscription_total`) → initial payment ≤ total. Writes subscription + players (+ payment) and logs `subscription.created` (+ `payment.recorded`).
- `record_payment(p_subscription_id, p_amount_fils, p_method default 'cash', p_paid_at default today, p_note) → uuid` — amount > 0, not future-dated, `paid + amount ≤ total`, subscription not cancelled.
- `cancel_subscription(p_subscription_id, p_reason)` — reason required; payments are kept.
- `calc_subscription_total(plan, tshirt_total, transport_total, type, value) → (subtotal, discount, total)` — internal, pinned to the worked examples (pgTAP + `pricing.test.ts`). `today_bh()` — the academy's date (D-047). `subscription_player_names`, `add_payment_internal` — internal.
- **Error codes** (`ajyal:<code>`): `forbidden`, `player_not_found`, `invalid_players`, `invalid_dates`, `plan_unavailable`, `overlap`, `discount_not_found|inactive|not_started|expired|exhausted|conflict`, `manual_discount_reason_required|invalid`, `overpayment`, `invalid_amount`, `invalid_date`, `subscription_not_found|cancelled`, `already_cancelled`, `reason_required`.
- **Views** (`security_invoker`, D-049): `subscription_overview` = subscription + `plan_code`, `paid_fils`, `balance_fils`, `status`, `player_names` (visible players only), `player_count`; `player_subscription_status` = one row per player with the subscription that best describes them (current → upcoming → latest; cancelled ignored).

Player create/update use plain table access + triggers (RLS-scoped); **removal is the `remove_player(id)` RPC** (D-033). The activity trigger records the actor via `auth.uid()`.

**Implementation status:** `calc_subscription_total`, `create_subscription`, `record_payment`, `cancel_subscription` ✅ (Phase 4 — see below) · `remove_player` ✅ (Phase 2) · `assign_players(p_player_ids uuid[], p_coach_id uuid default null) → integer` ✅ (Phase 3: admin only; `null` unassigns; skips removed players and rows already on that coach; max 500; the players trigger logs one `player.reassigned` per changed player; D-042) · `save_attendance(p_session_id uuid, p_records jsonb) → void` ✅ (Phase 5) · `generate_monthly_salaries(p_month date) → (created_count, skipped_count, created_fils)`, `report_summary(p_from date, p_to date) → (collected_fils, expenses_fils, profit_fils, margin_bps)`, `revenue_by_month(p_year integer) → 12 × (month_start, collected_fils, expenses_fils, profit_fils)`, `expenses_by_category(p_from date, p_to date) → (category, total_fils)` ✅ (Phase 6 — see below).

### As built (Phase 5)

- **Sessions are written with plain table access** (RLS: an admin any coach's session, a coach their own — the update policy cannot move a session to another coach). The `trg_sessions_guard` trigger adds what RLS cannot express: `created_by` is always the caller; a new session is never already cancelled; the session's coach must be an **active coach** (`ajyal:invalid_coach`); cancelling stamps the server time and is **final** — a cancelled session is read-only (`ajyal:session_cancelled`); a session that already has attendance cannot change coach (`ajyal:session_has_attendance`). A weekly series is one multi-row `insert` (one statement, all-or-nothing); each row logs `session.created`.
- `save_attendance(p_session_id, p_records)` — `p_records` = `[{ "player_id": uuid, "status": "present" | "absent" }, …]`, at least one, each player once. Checks, in order: caller active → session visible (`can_view_session`) and existing → not cancelled → **not dated after today's academy date** (`today_bh()`, D-047 — a session later today can be marked) → records well-formed → every player on the **roster** (the session coach's players, not removed) → upsert → one `attendance.saved` log entry (`session_date`, `start_time`, `coach_name`, `present_count`, `total_count`). All-or-nothing; the session row is locked first (`for update`) so it serialises with cancelling/editing. Rows whose status did not change keep their `marked_by`/`marked_at`. Players not mentioned keep their mark.
- **Error codes** (`ajyal:<code>`): `forbidden`, `session_not_found`, `session_cancelled`, `session_in_future`, `session_has_attendance`, `invalid_coach`, `invalid_records`, `not_on_roster`.
- **View** `player_attendance` (`security_invoker`, D-059): one row per mark joined with its session (`player_id, session_id, status, marked_at, session_date, start_time, end_time, location, coach_id`), **cancelled sessions left out**; RLS applies as the caller, so a coach only sees marks from sessions they run.

### As built (Phase 6)

- **Expenses are written with plain table access** (admin only, RLS from Phase 2). `trg_expenses_guard` (BEFORE INSERT/UPDATE) adds what RLS cannot express: `created_by` is always the caller and cannot be edited; an expense **cannot be dated after today's academy date** (`ajyal:future_date`, D-047 — checked on insert and when the date changes); a salary's coach must have role `coach` (`ajyal:invalid_coach`; an inactive coach can still be paid for a past month). The table's own checks still tie `coach_id` to `coach_salary` and require an amount above zero. Updates and deletes are logged by `trg_expenses_activity_change` (`expense.updated` / `expense.deleted`, snapshot `category`, `amount_fils`, `expense_date`) — an expense is hard-deleted, so the log is what remains of it (D-063).
- `generate_monthly_salaries(p_month)` — admin only. `p_month` is any date in the month; a month after the current one is refused (`ajyal:invalid_period`). Inserts, for each **active** coach with `monthly_salary_fils > 0` who has no `coach_salary` expense dated in that month, one expense dated the **1st** with the salary as it is now. Returns how many were created, how many eligible coaches were skipped, and the fils created. A transaction-level advisory lock per month serialises two admins pressing the button together. It logs **one** `expense.salaries_generated` entry (`month`, `created_count`, `created_fils`) — and only when something was created; the per-row `expense.created` entries are switched off for the run (`ajyal.bulk`). D-065.
- **Report functions** (`report_summary`, `revenue_by_month`, `expenses_by_category`) are `SECURITY DEFINER` with an explicit active-admin check: through RLS a coach can read the payments of their own players, so a plain invoker function would have let them add up the academy's takings. Ranges are **inclusive** on `payments.paid_at` / `expenses.expense_date`; `report_summary` sums every payment, including those of cancelled subscriptions and removed players (the money was received); `margin_bps = round(profit × 10000 ÷ collected)` half away from zero, `null` when nothing was collected; `revenue_by_month` always returns 12 rows, zero where nothing happened, and its `month_start` values are the 1st of each month; `expenses_by_category` returns only categories that have expenses, biggest first. All date maths is plain `date` arithmetic (no time-zone round trips). D-064.
- **Error codes** (`ajyal:<code>`): `forbidden`, `invalid_period` (a from after to, a missing date, a year outside 2000–2100, or a future month for salaries), `future_date`, `invalid_coach`.
- pgTAP: `supabase/tests/database/06_finance_reports.test.sql` (77 assertions): the worked example, month/year/leap-day edges, zero-filled months, year = Σ of its 12 months, rounding half away from zero, admin-only access (coach, inactive admin, signed-out), salary generation idempotency, the guard trigger and the activity trail.

### As built (Phase 7)

No schema change. The home feed reads `activity_log` as the caller — row-level security decides whose entries these are (an admin all, a coach only `actor_id = auth.uid()`) — newest first, paged by **cursor** (`created_at`, `id`) rather than by offset, so an entry arriving live at the top never shifts the next page; entries written in one transaction share a timestamp, hence the `id` tie-break. The table is in the `supabase_realtime` publication (Phase 2); the app subscribes to `INSERT`s, which Realtime filters by the same policy. The chips filter on `entity_type`: players `player` · subscriptions `subscription` · payments `payment` · sessions `session`, `attendance` · expenses `expense` · other `discount`, `coach`. Every action listed above has a translated sentence (`activity` namespace).

### As built (Phase 9)

- **Migration** `20260920100000_locations.sql`. It creates `locations`, adds `location_id` to `training_sessions`, `players`, `expenses` and `subscriptions`, **backfills** sessions from the old free text (one location per distinct name compared trimmed and case-insensitively; a cancelled session's guard is switched off for that one `UPDATE`, inside the migration's transaction), drops `training_sessions.location`, and rebuilds the views that exposed it (`player_attendance`: `location_id`, `location_name` instead of `location`; `subscription_overview`: + `location_id`, `location_name` — the view reads `s.*`, so it had to be recreated).
- **`create_subscription`** got a **required** `p_location_id` right after `p_players` (`ajyal:location_required` when null, `ajyal:invalid_location` when unknown or switched off); the `subscription.created` log entry names the location.
- **`set_subscription_location(p_subscription_id, p_location_id)`** — admin only, allowed on any subscription (even cancelled or expired); a no-op when nothing changes; logs `subscription.location_changed` with `player_names`, `from_location_name` (null when it had none) and `to_location_name`.
- **Reports:** `report_summary`, `revenue_by_month` and `expenses_by_category` take an optional `p_location_id` (null = everything); a payment belongs to its subscription's location, an expense to its own, so a location's figures **exclude academy-wide expenses** (D-085). `report_by_location(from, to)` returns each location that is active or has money in the period plus one row with a null `location_id` for what has none yet; its rows add up to `report_summary` (pgTAP). All four remain `SECURITY DEFINER` with an admin check.
- **Feed summaries:** `session.created` and `subscription.created` carry `location_name`; `location.created` (`location_name`), `location.updated` (`location_name`, `previous_name`, `active`).
- **Error codes** (`ajyal:<code>`): `location_required`, `invalid_location`, plus the existing `forbidden`, `subscription_not_found`, `invalid_period`.
- pgTAP: `supabase/tests/database/07_locations.test.sql` (86 assertions); `01`, `04` and `05` were adapted (a default location for sessions, `create_subscription` takes a location).

## Triggers

- `locations` AFTER INSERT/UPDATE → `location.created` / `location.updated` (an update that changes nothing is not logged).
- `trg_sessions_guard`, `trg_players_guard`, `trg_expenses_guard`: a location, when set or changed, must be an **active** location (`ajyal:invalid_location`); a session also requires one on insert and cannot lose it (`ajyal:location_required`).
- `on_auth_user_created` → nothing (profiles are inserted by the `create-coach` Edge Function / seed, never self-signup).
- `players` AFTER INSERT → `player.created`; AFTER UPDATE of `deleted_at` (null → not null) → `player.removed`; AFTER UPDATE of `coach_id` → `player.reassigned`.
- `training_sessions` BEFORE INSERT/UPDATE → `trg_sessions_guard` (see Phase 5 above).
- `discounts` AFTER INSERT → `discount.created`; `training_sessions` AFTER INSERT/cancel → `session.*`; `expenses` AFTER INSERT → `expense.created` (skipped inside `generate_monthly_salaries`), AFTER UPDATE/DELETE → `expense.updated` / `expense.deleted`; `expenses` BEFORE INSERT/UPDATE → `trg_expenses_guard` (see Phase 6 above).
- All activity inserts are `SECURITY DEFINER` functions (`log_activity`, not callable through the API); the table itself has **no insert policy** for clients. `coach.created` is written by the `create-coach` Edge Function (D-038).

## RLS matrix

`A` = admin, `C` = coach. "own" = `players.coach_id = auth.uid()` (or a record tied to such a player / created by that coach).

| Table                  | Select                                     | Insert                            | Update                                     | Delete                        |
| ---------------------- | ------------------------------------------ | --------------------------------- | ------------------------------------------ | ----------------------------- |
| `profiles`             | A: all · C: self only (D-034)              | Edge Function only (service role) | A: all · C: self (language only)           | none                          |
| `players`              | A: all · C: own                            | A · C (forced `coach_id = uid`)   | A: all · C: own (cannot change `coach_id`) | none (soft delete via update) |
| `plans`, `settings`    | A, C read                                  | A                                 | A                                          | none                          |
| `discounts`            | A: all · C: active only (to apply code)    | A                                 | A                                          | none                          |
| `subscriptions`        | A: all · C: those containing an own player | via RPC only                      | via RPC only                               | none                          |
| `subscription_players` | as subscriptions                           | via RPC only                      | none                                       | none                          |
| `payments`             | as subscriptions                           | via RPC only                      | none                                       | none                          |
| `training_sessions`    | A: all · C: own (`coach_id = uid`)         | A · C (forced own)                | A · C own                                  | none (cancel)                 |
| `locations`            | A, C read (inactive too)                   | A                                 | A (`name`, `address`, `active`)            | none (switch off)             |
| `attendance`           | A: all · C: sessions they run              | via RPC only                      | via RPC only                               | none                          |
| `expenses`             | A                                          | A                                 | A                                          | A                             |
| `activity_log`         | A: all · C: `actor_id = uid`               | none (definer functions only)     | none                                       | none                          |

RLS tests live in `supabase/tests/` and must cover: coach A cannot read/update coach B's players, subscriptions, sessions, attendance; a coach cannot read `expenses`, `report_*`; nobody can write `activity_log` directly.

## Seed data (Phase 2)

- `plans`: solo/1/20000, duo/2/35000, trio/3/50000, quad/4/60000.
- `settings`: single row with placeholder fees (see [08-decisions.md](08-decisions.md) open questions).
- Demo users (local only): `admin@ajyal.local`, `coach1@ajyal.local`, `coach2@ajyal.local` with a documented dev password, plus a handful of sample players.
