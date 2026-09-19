import { z } from 'zod'
import { isValidISODate, todayISO } from '@/lib/dates'
import { parseBD } from '@/lib/money'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './categories'

/** 100,000 BD — a sanity ceiling far above any real expense, well inside the column's integer range. */
export const MAX_EXPENSE_FILS = 100_000_000

export interface ExpenseInput {
  category: ExpenseCategory
  amount_fils: number
  expense_date: string
  coach_id: string | null
  description: string | null
}

// Messages are `expenses` namespace keys, translated where they are rendered.
export const expenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    /** BD as typed, e.g. "12.500"; converted by `toExpenseInput`. */
    amount: z
      .string()
      .trim()
      .refine((value) => (parseBD(value) ?? 0) > 0, 'form.amount.invalid')
      .refine((value) => (parseBD(value) ?? 0) <= MAX_EXPENSE_FILS, 'form.amount.tooHigh'),
    expense_date: z
      .string()
      .refine(isValidISODate, 'form.date.invalid')
      // The database judges "future" on the academy's date; this catches the common slip early.
      .refine((value) => value <= todayISO(), 'form.date.future'),
    /** Only meaningful for a salary; ignored (and cleared) for every other category. */
    coach_id: z.string(),
    description: z.string().trim().max(200, 'form.description.tooLong'),
  })
  .superRefine((values, ctx) => {
    if (values.category === 'coach_salary' && values.coach_id === '') {
      ctx.addIssue({ code: 'custom', path: ['coach_id'], message: 'form.coach.required' })
    }
  })

export type ExpenseFormValues = z.infer<typeof expenseSchema>

/** Form values (already validated) → the row to store. */
export function toExpenseInput(values: ExpenseFormValues): ExpenseInput {
  return {
    category: values.category,
    amount_fils: parseBD(values.amount) ?? 0,
    expense_date: values.expense_date,
    coach_id: values.category === 'coach_salary' ? values.coach_id : null,
    description: values.description === '' ? null : values.description,
  }
}
