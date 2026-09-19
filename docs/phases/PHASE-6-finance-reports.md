# Phase 6 — Finance & reports

**Status:** Not started · **Requirements:** R-08, R-09

## Goal

Track expenses and give admins clear reports: fees collected per month/year, total revenue vs expenses, profit and margin.

## Read first

[05-business-rules.md](../05-business-rules.md#expenses-and-reports), [04-data-model.md](../04-data-model.md) (`expenses`, report RPCs), [06-design-system.md](../06-design-system.md#charts-recharts) (charts)

## Tasks

- [ ] `features/expenses`: CRUD (category, amount, date, description, coach for salaries); list with month filter and category chips; totals bar
- [ ] **Generate monthly salaries:** month picker → `generate_monthly_salaries` (idempotent) → shows created/skipped counts; salaries editable per coach on the Coaches page (already has `monthly_salary_fils`)
- [ ] Implement RPCs: `report_summary(from,to)`, `revenue_by_month(year)`, `expenses_by_category(from,to)` + **SQL tests** with fixtures matching the example in 05-business-rules (collected 540 / expenses 210 → profit 330, margin 61.11%); ensure `paid_at`/`expense_date` boundaries (month/year edges) are correct
- [ ] `src/lib/reports.ts` (pure helpers: margin from fils, period ranges, CSV building) + unit tests (margin "—" when collected = 0, negative profit)
- [ ] **Reports page (admin):** period selector (month | year, prev/next), KPI cards (Collected, Expenses, Profit, Margin %), **monthly revenue vs expenses chart** for the selected year, **expenses-by-category** breakdown, month table for the year, negative values in danger color
- [ ] **CSV export** of the period's payments and expenses (Arabic-safe: UTF-8 with BOM)
- [ ] i18n `expenses`, `reports` namespaces (AR + EN); chart labels/tooltips translated, values as `x.xxx BD`
- [ ] Tests: report math, salary generation idempotency, expense form validation

## Acceptance criteria

- Collected fees for a month/year equal the sum of payments dated in that period (verified against seeded data / SQL test).
- Profit and margin match the worked example; year view equals the sum of its 12 months.
- Salary generation run twice in the same month creates no duplicates.
- Coach role cannot open `/admin/reports` or `/admin/expenses` and the RPCs reject non-admins.
- Charts and tables are readable at 390px (charts scroll/scale gracefully, no horizontal page scroll), AR and EN.
- Docs updated; all checks pass.

## Out of scope

Per-branch reporting (Q-005), tax/VAT, accounting exports, refunds.

## Handoff notes

_(fill in when done)_
