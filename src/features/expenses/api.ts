import type { DateRange } from '@/lib/reports'
import { supabase } from '@/lib/supabase'
import type { ExpenseCategory } from './categories'
import type { ExpenseInput } from './schema'

/** An `expenses` row with the salary's coach embedded. */
export interface ExpenseRow {
  id: string
  category: ExpenseCategory
  amount_fils: number
  expense_date: string
  coach_id: string | null
  description: string | null
  created_by: string | null
  created_at: string
  coach: { full_name: string } | null
}

export interface ExpenseFilters {
  range: DateRange
  category: ExpenseCategory | 'all'
}

export const EXPENSES_PAGE_SIZE = 25

// `created_by` is a second foreign key to `profiles`, so the embed needs the constraint name.
const EXPENSE_COLUMNS = '*, coach:profiles!expenses_coach_id_fkey(full_name)'

/** A month's expenses, newest first (`total` counts every match, for "show more"). */
export async function listExpenses(
  filters: ExpenseFilters,
  page: number,
): Promise<{ rows: ExpenseRow[]; total: number }> {
  let query = supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS, { count: 'exact' })
    .gte('expense_date', filters.range.from)
    .lte('expense_date', filters.range.to)
  if (filters.category !== 'all') query = query.eq('category', filters.category)
  query = query
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')

  const from = page * EXPENSES_PAGE_SIZE
  const { data, error, count } = await query.range(from, from + EXPENSES_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as unknown as ExpenseRow[], total: count ?? 0 }
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { error } = await supabase.from('expenses').insert(input)
  if (error) throw error
}

/** Row-level security hides expenses from non-admins, so "no row changed" means "not there (any more)". */
export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { data, error } = await supabase.from('expenses').update(input).eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('ajyal:expense_not_found')
}

export async function deleteExpense(id: string): Promise<void> {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('ajyal:expense_not_found')
}

export interface SalaryRun {
  created: number
  skipped: number
  totalFils: number
}

/** Idempotent: a coach who already has a salary expense that month is skipped. `month` is any date in it. */
export async function generateMonthlySalaries(month: string): Promise<SalaryRun> {
  const { data, error } = await supabase.rpc('generate_monthly_salaries', { p_month: month })
  if (error) throw error
  const row = data[0]
  if (!row) throw new Error('generate_monthly_salaries returned no row')
  return { created: row.created_count, skipped: row.skipped_count, totalFils: row.created_fils }
}
