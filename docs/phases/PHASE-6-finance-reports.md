# Phase 6 — Finance & reports

**Status:** Done — automated and browser checks complete; owner's live check pending · **Requirements:** R-08, R-09

## Goal

Track expenses and give admins clear reports: fees collected per month/year, total revenue vs expenses, profit and margin.

## Read first

[05-business-rules.md](../05-business-rules.md#expenses-and-reports), [04-data-model.md](../04-data-model.md) (`expenses`, report RPCs — "As built (Phase 6)"), [06-design-system.md](../06-design-system.md#charts-recharts) (charts)

## Tasks

- [x] `features/expenses`: CRUD (category, amount, date, note, coach for salaries); a month list with a month switcher (never past the current month), category chips and a totals bar; "Show more" paging; delete asks first
- [x] **Generate monthly salaries:** month picker → `generate_monthly_salaries` (idempotent) → shows the coaches it will pay, then the created / skipped counts; salaries stay editable per coach on the Coaches page (already had `monthly_salary_fils`); a salary expense prefills the chosen coach's salary
- [x] RPCs `report_summary(from,to)`, `revenue_by_month(year)`, `expenses_by_category(from,to)`, `generate_monthly_salaries(month)` + the expenses guard trigger and the update/delete trail, with **SQL tests** (`supabase/tests/database/06_finance_reports.test.sql`, 77 assertions) on fixtures matching the worked example (collected 540 / expenses 210 → profit 330, margin 61.11%), month / year / leap-day edges, and year = Σ of its 12 months. Migration `20260919101000_finance_reports.sql`
- [x] `src/lib/reports.ts` (pure helpers: margin from fils, periods, CSV building) + unit tests (margin "—" when collected = 0, negative profit, rounding half away from zero like the database)
- [x] **Reports page (admin):** period selector (month | year, prev/next), KPI cards (Collected, Expenses, Profit, Margin %), **collected vs expenses chart** for the selected year (bars + a profit line), **expenses-by-category** breakdown, a month-by-month table with a year total row, negative values in the danger colour (and signed)
- [x] **CSV export** of the period's payments and expenses (two files; UTF-8 with BOM, Arabic-safe; formula-looking text neutralised)
- [x] i18n `expenses`, `reports` namespaces (AR + EN); chart legend / tooltip / table labels translated, values as `x.xxx BD`
- [x] Tests (Vitest: 505 in total): report math, period maths, CSV builders, expense form validation, the expenses page (list, chips, months, paging, add / edit / delete, salary generation and its result), the reports page (worked example, loss, empty, navigation, year view, export), the chart, `Money` with a negative amount, and the route guard for `/admin/expenses` and `/admin/reports`

## Acceptance criteria — results

- [x] **Collected fees for a month/year equal the sum of payments dated in that period** (pgTAP: October 540 000 fils, the 31st / 1st and 30th / 31st Dec / 1st Jan edges, a leap day, payments of a cancelled subscription still counted).
- [x] **Profit and margin match the worked example; year view equals the sum of its 12 months** (pgTAP: `330000 / 6111`, and Σ of `revenue_by_month` = `report_summary` for collected, expenses and profit; browser: October's KPIs and the table's year row equal the year KPIs).
- [x] **Salary generation run twice in the same month creates no duplicates** (pgTAP: `2/0` then `0/2`; a coach paid by hand mid-month is skipped; one log entry per run that created something; inactive coaches and zero salaries are left out).
- [x] **Coach role cannot open `/admin/reports` or `/admin/expenses` and the RPCs reject non-admins** (pgTAP: a coach, an inactive admin and a signed-out caller are refused by all four functions and by the `expenses` table; a Vitest route test and the browser check show a coach redirected to `/coach` with no Reports / Expenses in their navigation).
- [x] **Charts and tables are readable at 390px** in Arabic and English: no horizontal scroll, the month table fits without inner scrolling, the tooltip stays inside the viewport, all 12 month ticks show, tap targets ≥ 44px — 460 checks in Chrome with mocked API responses (Claude has no login), plus a look at the screenshots (which found the amount error that survived a salary prefill; fixed with a regression test).
- [x] Every new request shape checked against the hosted project as `anon` (11 shapes accepted by PostgREST → "permission denied"; five deliberately wrong controls fail at parsing with `PGRST200` / `42703` / `PGRST100` / `PGRST202`).
- [x] `typecheck`, `lint`, `test` (505), `build` pass; pgTAP 77/77 on the hosted project (all rolled back — the real rows are untouched); advisors: only the intentional SECURITY DEFINER notes (now 16 functions) and the known leaked-password setting; docs updated (`02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`).
- [ ] **Owner's live check** with the real accounts (numbers on the real payments, a real CSV opened in Excel).

## Out of scope

Per-branch reporting (Q-005), tax/VAT, accounting exports, refunds.

## Handoff notes

- **Where things are:** SQL `supabase/migrations/20260919101000_finance_reports.sql` and `06_finance_reports.test.sql`; TS `src/lib/reports.ts` (margin, periods, CSV), `src/features/expenses`, `src/features/reports`; fixtures `src/test/finance.ts`. Architecture: `03-architecture.md` → "As built (Phase 6)"; SQL contract: `04-data-model.md` → "As built (Phase 6)"; rules: `05-business-rules.md` → "Expenses and reports".
- **Decisions to confirm with the owner** (D-063…D-068): expenses cannot be dated in the future; editing / deleting an expense is logged; salary generation skips a coach who already has any salary that month and refuses a future month; the margin is "—" (not −100 %) when nothing was collected; CSV is two files with plain 3-decimal amounts. Nothing here needed a new open question (Q-005, per-branch reporting, is still open and out of scope).
- **Phase 7 (home & activity):** three new actions need a translated sentence each — `expense.updated` and `expense.deleted` (summary: `category`, `amount_fils`, `expense_date`) and `expense.salaries_generated` (summary: `month`, `created_count`, `created_fils`; its `entity_id` is null). `expense.created` (`category`, `amount_fils`) is now logged only for hand-made expenses. The home KPIs "collected this month" and "net profit this month" can use `useReportSummary(periodRange(currentPeriod('month')))` — admin only, so a coach's home must not call it.
- **Gotchas:** the report functions are `SECURITY DEFINER` on purpose (see D-064) — do not turn them into invoker functions; the hosted database holds real rows, so a pgTAP file that needs exact totals must clear `payments`, `expenses` and coach salaries inside its own rolled-back transaction (this one does); a `returns table` function's column names are variables inside its body, so qualify every column; Recharts needs a sized container, so component tests replace `RevenueChart` with a stub (the chart has its own smoke test) and the real chart is checked in the browser; SVG `<text>` has no `innerText` (use `textContent` in browser scripts); in the harness, Radix toasts stack over bottom sheets — wait for them to clear before screenshotting a dialog.
- **Known limits (by design):** the future-date rule for expenses is judged on the academy's date, but the period switcher and the form's date limit use the browser's date (D-047); "collected" is by `paid_at`, so a payment recorded late but dated in an earlier month lands in that earlier month; the CSV is built in the browser from everything in the period, so a very large year (tens of thousands of rows) would be slow — fine for an academy of this size; `expenses.coach_id` / `created_by` and a few earlier foreign keys have no covering index (advisor INFO, harmless at this size).
- **Pre-existing, not touched:** the phone link on the player page is an 18px tap target (Phase 3); the Arabic placeholder in an empty `dir="auto"` input aligns left; the main bundle is ~1.1 MB and still needs code-splitting beyond the reports page (Phase 8).
