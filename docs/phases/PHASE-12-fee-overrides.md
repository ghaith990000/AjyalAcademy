# Phase 12 — per-player fee overrides

**Status:** Done — automated and browser checks complete; the owner's live check is pending · **Requirements:** R-20

## Goal

An admin creating a subscription can type a special T-shirt and/or transport price for one player — some players have their own arrangement, not the unified fee set in Settings. Nothing is remembered afterward: it is typed fresh, one subscription at a time.

## Read first

[04-data-model.md](../04-data-model.md) (`subscription_players`, `create_subscription`), [05-business-rules.md](../05-business-rules.md#fees), Phase 4 ([PHASE-4](PHASE-4-subscriptions.md)) — this phase extends the same wizard and the same RPC.

## Decision taken with the owner (2026-09-27)

- **Per-subscription only, not on the player record.** Asked directly (a special price stored on the player vs. typed fresh each time): the owner chose the latter — no new field to keep in sync or remember to clear (D-103).

## Design (Claude's defaults — change freely)

- **Admin only**, exactly like the existing T-shirt waive/force override (D-048, D-104) — a coach's attempt is ignored server-side, not merely hidden in the UI.
- **The input appears only once the fee itself applies** — under the T-shirt checkbox when it is ticked, under Transport when it is ticked — so there is never a special-price field for a fee nobody is being charged.
- **Blank means "use the Settings amount," not zero.** Charging nothing for an applying fee is already possible: untick Transport, or (T-shirt) use the existing waive checkbox. A negative typed amount is refused (`ajyal:invalid_fee`, D-105).
- **Text-based input**, matching the wizard's existing `manualValue`/`payAmount` pattern: the typed string is kept as-is in the draft (so an in-progress or invalid value is preserved and validated separately from "untouched"), parsed to fils only when computing the live total or building the RPC call.

## Tasks

- [x] **Migration:** `create or replace function create_subscription` — `p_players` entries gain optional `tshirt_fee_fils` / `transport_fee_fils`, honoured for admins only; `ajyal:invalid_fee` (`22023`) for a negative value; pgTAP `04_subscriptions.test.sql` extended (127 assertions total)
- [x] **`draft.ts`:** `tshirtFeeText` / `transportFeeText` per player, `tshirtFeeFor` / `transportFeeFor` (special price if admin and valid, else the Settings amount), `hasInvalidFee` wired into `validateStep('options', …)`, `buildParams` sends the override only when admin + a valid non-blank amount
- [x] **`OptionsStep.tsx`:** a `Field`/`Input` under each ticked fee, admin only, with a hint that blank means the standard fee
- [x] i18n (`subscriptions` namespace: `wizard.options.specialPrice*`, `error.fee_invalid`), unit tests (`draft.test.ts`, `NewSubscriptionPage.test.tsx`), docs (`02`, `04`, `05`, `08`, roadmap)

## Acceptance criteria — results

- [x] **An admin can charge a first-time player a special T-shirt and/or transport fee instead of the Settings amount; the special amount, not the Settings one, is snapshotted** — pgTAP `04` (`T10`/`T10b`), unit tests (`tshirtFeeFor`/`transportFeeFor`, the worked-example pricing test), `NewSubscriptionPage.test.tsx` (live total updates when typed, the RPC payload carries `tshirt_fee_fils`).
- [x] **A coach's special-price attempt is ignored — the standard Settings fee is charged instead, and the field is never shown to them** — pgTAP `04` (`T10c`), unit test (`tshirtFeeFor`/`transportFeeFor` with `isAdmin: false`), `NewSubscriptionPage.test.tsx` (the field does not render for a coach).
- [x] **A negative special price is refused and creates nothing** — pgTAP `04` (`ajyal:invalid_fee`, then a count confirming no row was created), unit test (`validateStep` returns `'fee_invalid'`, `buildParams` omits it).
- [x] **A blank field means the Settings amount, not zero** — unit tests (`specialFee`/`tshirtFeeFor` with an empty/whitespace string, `hasInvalidFee` unaffected).
- [x] `typecheck`, `lint`, `test` (840), `build`, `e2e` (153) pass; pgTAP `04` (127) passes on the hosted project, rolled back.

## Out of scope

A special price remembered on the player record for future subscriptions (D-103 — the owner's own choice); a separate "waive transport" control distinct from unticking the checkbox; bulk-editing special prices across many players at once.

## Handoff notes

- **The database was migrated on the hosted project on 2026-09-27** (file `20260927130000_subscription_fee_overrides.sql`; recorded there as `subscription_fee_overrides`). Deploy the website from this commit or later.
- **What the owner will see first:** nothing changes for a subscription with no special price. As admin, ticking T-shirt or Transport for a player now shows an extra "Special price for this player" field beneath it; leaving it blank behaves exactly as before.
- **Where things are:** SQL `supabase/migrations/20260927130000_subscription_fee_overrides.sql`, `supabase/tests/database/04_subscriptions.test.sql` (player `tests.u(25)`, tests `T10`/`T10b`/`T10c` + the negative-fee case); TS `src/features/subscriptions/draft.ts` (`tshirtFeeFor`, `transportFeeFor`, `hasInvalidFee`), `src/features/subscriptions/wizard/OptionsStep.tsx`. Docs: `04` "As built (Phase 12)", `05` Fees section, `08` D-103…D-105.
- **Gotchas:** the pgTAP fixtures share one file across all subscription tests — a new test player must be **dedicated** (not reused from an existing one), or an unrelated, untouched assertion elsewhere in the same file can start failing (found while building this phase: player `20` was already asserted to have zero `subscription_players` rows by a later, unrelated overpayment test).
