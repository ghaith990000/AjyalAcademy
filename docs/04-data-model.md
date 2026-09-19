# Data model (Postgres / Supabase)

Status: **migrated in Phase 2** — tables, constraints, RLS, guard/activity triggers and `remove_player` exist (`supabase/migrations/`). Other RPCs are implemented in the phase that uses them (see the RPC table). This doc is the contract; migrations must match it. Update both together.

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

| Column                | Type            | Notes                                                             |
| --------------------- | --------------- | ----------------------------------------------------------------- |
| `full_name`           | text not null   |                                                                   |
| `cpr`                 | text not null   | **unique** (among non-deleted), check `^[0-9]{9}$`                |
| `date_of_birth`       | date not null   | must be in the past                                               |
| `address`             | text            |                                                                   |
| `school`              | text            |                                                                   |
| `phone`               | text not null   | guardian/contact number                                           |
| `has_disease`         | bool not null   | default false                                                     |
| `disease_description` | text            | **check:** required (non-empty) when `has_disease`, null when not |
| `coach_id`            | uuid → profiles | nullable (unassigned); admin assigns; coach-created ⇒ that coach  |
| `created_by`          | uuid → profiles |                                                                   |
| `deleted_at`          | timestamptz     | soft delete; `deleted_by uuid` also stored                        |

Indexes: `(coach_id) where deleted_at is null`, trigram/`ilike` search on `full_name`, unique partial index on `cpr where deleted_at is null`.

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

| Column                          | Type               | Notes                                                         |
| ------------------------------- | ------------------ | ------------------------------------------------------------- |
| `plan_id`                       | uuid → plans       |                                                               |
| `start_date`                    | date not null      |                                                               |
| `end_date`                      | date not null      | inclusive; check `end_date >= start_date`                     |
| `plan_price_fils`               | int not null       | **snapshot** of plan price at creation                        |
| `tshirt_total_fils`             | int not null       | sum of `subscription_players.tshirt_fee_fils`                 |
| `transport_total_fils`          | int not null       | sum of `subscription_players.transport_fee_fils`              |
| `discount_id`                   | uuid → discounts   | nullable (null for manual or none)                            |
| `discount_type`                 | discount_type      | nullable (snapshot)                                           |
| `discount_value`                | int                | nullable; bps for percent, fils for fixed                     |
| `discount_reason`               | text               | required when a manual discount is used                       |
| `discount_fils`                 | int not null       | default 0; the computed discount amount                       |
| `total_fils`                    | int not null       | `plan_price + tshirt + transport − discount`, server-computed |
| `cancelled_at` / `cancelled_by` | timestamptz / uuid | soft cancel                                                   |
| `created_by`                    | uuid → profiles    |                                                               |

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

| Column         | Type            | Notes                                                 |
| -------------- | --------------- | ----------------------------------------------------- |
| `session_date` | date not null   |                                                       |
| `start_time`   | time not null   |                                                       |
| `end_time`     | time not null   | check `end_time > start_time`                         |
| `coach_id`     | uuid → profiles | who runs it; its roster = that coach's active players |
| `location`     | text            | e.g. field name                                       |
| `notes`        | text            |                                                       |
| `cancelled_at` | timestamptz     |                                                       |
| `created_by`   | uuid → profiles |                                                       |

### `attendance`

| Column       | Type                                       | Notes                        |
| ------------ | ------------------------------------------ | ---------------------------- |
| `session_id` | uuid → training_sessions on delete cascade |                              |
| `player_id`  | uuid → players                             | PK `(session_id, player_id)` |
| `status`     | attendance_status                          |                              |
| `marked_by`  | uuid → profiles                            |                              |
| `marked_at`  | timestamptz                                |                              |

### `expenses`

| Column         | Type             | Notes                                 |
| -------------- | ---------------- | ------------------------------------- |
| `category`     | expense_category |                                       |
| `amount_fils`  | int (> 0)        |                                       |
| `expense_date` | date not null    | date used for monthly/yearly expenses |
| `coach_id`     | uuid → profiles  | only for `coach_salary`               |
| `description`  | text             |                                       |
| `created_by`   | uuid → profiles  |                                       |

### `activity_log`

| Column        | Type            | Notes                                                                                                  |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `actor_id`    | uuid → profiles | who did it                                                                                             |
| `action`      | text            | dotted key, see list below                                                                             |
| `entity_type` | text            | `player`, `subscription`, `payment`, `session`, `attendance`, `discount`, `expense`, `coach`           |
| `entity_id`   | uuid            |                                                                                                        |
| `summary`     | jsonb           | **snapshot** for display (e.g. `{ "player_name": "Ali", "plan": "duo" }`) so removed rows still render |
| `created_at`  | timestamptz     | indexed desc; table is in the `supabase_realtime` publication                                          |

Actions: `player.created`, `player.updated`, `player.removed`, `player.reassigned`, `subscription.created`, `subscription.cancelled`, `payment.recorded`, `discount.created`, `session.created`, `session.cancelled`, `attendance.saved`, `expense.created`, `coach.created`. UI maps each to a translated sentence with the `summary` values.

## RPCs and SQL functions

| Function                                 | Who                        | Purpose                                                                                                        |
| ---------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `calc_subscription_total(...)`           | internal                   | Authoritative total calculation (mirrors `src/lib/pricing.ts`).                                                |
| `create_subscription(...)`               | admin, coach (own players) | Validates, recomputes fees/discount/total, inserts subscription + players (+ optional payment), logs activity. |
| `record_payment(subscription_id, ...)`   | admin, coach (own)         | Adds a payment, guards overpayment, logs activity.                                                             |
| `cancel_subscription(id, reason)`        | admin, coach (own)         | Sets `cancelled_at`, logs activity.                                                                            |
| `save_attendance(session_id, records[])` | admin, session coach       | Upserts attendance rows, logs one `attendance.saved`.                                                          |
| `assign_players(player_ids[], coach_id)` | admin                      | Bulk (re)assignment, logs `player.reassigned`.                                                                 |
| `generate_monthly_salaries(month date)`  | admin                      | Idempotently inserts a `coach_salary` expense per active coach with a salary.                                  |
| `report_summary(from, to)`               | admin                      | `{ collected_fils, expenses_fils, profit_fils, margin_bps }`.                                                  |
| `revenue_by_month(year)`                 | admin                      | 12 rows: month, collected, expenses, profit.                                                                   |
| `expenses_by_category(from, to)`         | admin                      | category, total.                                                                                               |

Player create/update use plain table access + triggers (RLS-scoped); **removal is the `remove_player(id)` RPC** (D-033). The activity trigger records the actor via `auth.uid()`.

**Implementation status:** `remove_player` ✅ (Phase 2) · `assign_players(p_player_ids uuid[], p_coach_id uuid default null) → integer` ✅ (Phase 3: admin only; `null` unassigns; skips removed players and rows already on that coach; max 500; the players trigger logs one `player.reassigned` per changed player; D-042) · `calc_subscription_total`, `create_subscription`, `record_payment`, `cancel_subscription` → Phase 4 · `save_attendance` → Phase 5 · `generate_monthly_salaries`, `report_summary`, `revenue_by_month`, `expenses_by_category` → Phase 6 (D-032).

## Triggers

- `on_auth_user_created` → nothing (profiles are inserted by the `create-coach` Edge Function / seed, never self-signup).
- `players` AFTER INSERT → `player.created`; AFTER UPDATE of `deleted_at` (null → not null) → `player.removed`; AFTER UPDATE of `coach_id` → `player.reassigned`.
- `discounts` AFTER INSERT → `discount.created`; `training_sessions` AFTER INSERT/cancel → `session.*`; `expenses` AFTER INSERT → `expense.created`.
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
| `attendance`           | A: all · C: sessions they run              | via RPC only                      | via RPC only                               | none                          |
| `expenses`             | A                                          | A                                 | A                                          | A                             |
| `activity_log`         | A: all · C: `actor_id = uid`               | none (definer functions only)     | none                                       | none                          |

RLS tests live in `supabase/tests/` and must cover: coach A cannot read/update coach B's players, subscriptions, sessions, attendance; a coach cannot read `expenses`, `report_*`; nobody can write `activity_log` directly.

## Seed data (Phase 2)

- `plans`: solo/1/20000, duo/2/35000, trio/3/50000, quad/4/60000.
- `settings`: single row with placeholder fees (see [08-decisions.md](08-decisions.md) open questions).
- Demo users (local only): `admin@ajyal.local`, `coach1@ajyal.local`, `coach2@ajyal.local` with a documented dev password, plus a handful of sample players.
