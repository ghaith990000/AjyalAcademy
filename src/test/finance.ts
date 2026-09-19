import type { ExpenseRow } from '@/features/expenses/api'
import type { CategoryTotal, MonthRow, ReportSummary } from '@/features/reports/api'

let counter = 0

/** An `expenses` row (field rent, 50 BD, in October 2026). */
export function fakeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  counter += 1
  return {
    id: `e${counter}`,
    category: 'field_rent',
    amount_fils: 50000,
    expense_date: '2026-10-15',
    coach_id: null,
    description: null,
    created_by: 'admin-1',
    created_at: '2026-10-15T08:00:00Z',
    coach: null,
    ...overrides,
  }
}

/** The worked example from docs/05-business-rules.md: collected 540, expenses 210 → profit 330, margin 61.11%. */
export const OCTOBER_SUMMARY: ReportSummary = {
  collectedFils: 540_000,
  expensesFils: 210_000,
  profitFils: 330_000,
  marginBps: 6111,
}

export const OCTOBER_CATEGORIES: CategoryTotal[] = [
  { category: 'coach_salary', totalFils: 150_000 },
  { category: 'field_rent', totalFils: 50_000 },
  { category: 'transportation', totalFils: 10_000 },
]

/** Twelve month rows; `overrides` maps a month number to its figures (every other month is zero). */
export function fakeYear(
  overrides: Record<number, Partial<Omit<MonthRow, 'month'>>> = {},
): MonthRow[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const row = { month, collectedFils: 0, expensesFils: 0, profitFils: 0, ...overrides[month] }
    return {
      ...row,
      profitFils: overrides[month]?.profitFils ?? row.collectedFils - row.expensesFils,
    }
  })
}
