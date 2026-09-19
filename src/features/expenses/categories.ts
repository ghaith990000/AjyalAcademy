import type { Enums } from '@/lib/database.types'

export type ExpenseCategory = Enums<'expense_category'>

/** In the order the filters and the report list them (the database enum's order). */
export const EXPENSE_CATEGORIES = [
  'coach_salary',
  'field_rent',
  'transportation',
  'equipment',
  'other',
] as const satisfies readonly ExpenseCategory[]
