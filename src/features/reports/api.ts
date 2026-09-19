import type { ExpenseCategory } from '@/features/expenses/categories'
import type { Enums } from '@/lib/database.types'
import type { DateRange } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export interface ReportSummary {
  collectedFils: number
  expensesFils: number
  profitFils: number
  /** Basis points (61.11% = 6111); `null` when nothing was collected. */
  marginBps: number | null
}

export interface MonthRow {
  /** 1 = January … 12 = December */
  month: number
  collectedFils: number
  expensesFils: number
  profitFils: number
}

export interface CategoryTotal {
  category: ExpenseCategory
  totalFils: number
}

/** All three report functions insist on an active admin (`ajyal:forbidden` otherwise). */
export async function getReportSummary(range: DateRange): Promise<ReportSummary> {
  const { data, error } = await supabase.rpc('report_summary', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  const row = data[0]
  if (!row) throw new Error('report_summary returned no row')
  return {
    collectedFils: row.collected_fils,
    expensesFils: row.expenses_fils,
    profitFils: row.profit_fils,
    marginBps: row.margin_bps,
  }
}

/** Always 12 rows, January first; months without activity are zero rows. */
export async function getRevenueByMonth(year: number): Promise<MonthRow[]> {
  const { data, error } = await supabase.rpc('revenue_by_month', { p_year: year })
  if (error) throw error
  return data.map((row) => ({
    month: Number(row.month_start.slice(5, 7)),
    collectedFils: row.collected_fils,
    expensesFils: row.expenses_fils,
    profitFils: row.profit_fils,
  }))
}

/** Only categories that have expenses in the range, biggest first. */
export async function getExpensesByCategory(range: DateRange): Promise<CategoryTotal[]> {
  const { data, error } = await supabase.rpc('expenses_by_category', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return data.map((row) => ({ category: row.category, totalFils: row.total_fils }))
}

// ---------------------------------------------------------------------------
// CSV export: every payment / expense of the period (not just a screenful)
// ---------------------------------------------------------------------------

export interface PaymentExportRow {
  paid_at: string
  amount_fils: number
  method: Enums<'payment_method'>
  note: string | null
  received_by: { full_name: string } | null
  subscription: {
    plan: { code: string } | null
    subscription_players: { player: { full_name: string } | null }[]
  } | null
}

export interface ExpenseExportRow {
  expense_date: string
  category: ExpenseCategory
  amount_fils: number
  description: string | null
  coach: { full_name: string } | null
}

/** PostgREST returns at most 1000 rows a request, so read a big period page by page. */
const EXPORT_PAGE = 1000

async function readAll<T>(page: (from: number, to: number) => PromiseLike<T[]>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += EXPORT_PAGE) {
    const chunk = await page(from, from + EXPORT_PAGE - 1)
    rows.push(...chunk)
    if (chunk.length < EXPORT_PAGE) return rows
  }
}

export function listPaymentsForExport(range: DateRange): Promise<PaymentExportRow[]> {
  return readAll(async (from, to) => {
    const { data, error } = await supabase
      .from('payments')
      .select(
        'paid_at, amount_fils, method, note, received_by:profiles!payments_received_by_fkey(full_name), subscription:subscriptions(plan:plans(code), subscription_players(player:players(full_name)))',
      )
      .gte('paid_at', range.from)
      .lte('paid_at', range.to)
      .order('paid_at')
      .order('created_at')
      .order('id')
      .range(from, to)
    if (error) throw error
    return data as unknown as PaymentExportRow[]
  })
}

export function listExpensesForExport(range: DateRange): Promise<ExpenseExportRow[]> {
  return readAll(async (from, to) => {
    const { data, error } = await supabase
      .from('expenses')
      .select(
        'expense_date, category, amount_fils, description, coach:profiles!expenses_coach_id_fkey(full_name)',
      )
      .gte('expense_date', range.from)
      .lte('expense_date', range.to)
      .order('expense_date')
      .order('created_at')
      .order('id')
      .range(from, to)
    if (error) throw error
    return data as unknown as ExpenseExportRow[]
  })
}
