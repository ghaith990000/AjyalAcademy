import type { Enums } from '@/lib/database.types'
import { CSV_BOM, toCsv } from '@/lib/reports'
import { formatBDAmount } from '@/lib/money'
import type { ExpenseCategory } from '@/features/expenses/categories'
import type { ExpenseExportRow, PaymentExportRow } from './api'

/** Already-translated text for the file (the file follows the language the admin is using). */
export interface PaymentsCsvLabels {
  headers: readonly [
    date: string,
    amount: string,
    method: string,
    players: string,
    plan: string,
    note: string,
    receivedBy: string,
  ]
  method: (method: Enums<'payment_method'>) => string
  plan: (code: string) => string
}

export interface ExpensesCsvLabels {
  headers: readonly [
    date: string,
    category: string,
    amount: string,
    coach: string,
    description: string,
  ]
  category: (category: ExpenseCategory) => string
}

/** Separates several players' names inside one cell. */
const NAME_SEPARATOR = '; '

/** Dates as yyyy-MM-dd and amounts as plain "540.000" (no currency text) so a spreadsheet can sort and sum them. */
export function buildPaymentsCsv(
  rows: readonly PaymentExportRow[],
  labels: PaymentsCsvLabels,
): string {
  const body = rows.map((row) => [
    row.paid_at,
    formatBDAmount(row.amount_fils),
    labels.method(row.method),
    (row.subscription?.subscription_players ?? [])
      .map((entry) => entry.player?.full_name)
      .filter((name): name is string => Boolean(name))
      .join(NAME_SEPARATOR),
    row.subscription?.plan ? labels.plan(row.subscription.plan.code) : '',
    row.note,
    row.received_by?.full_name ?? null,
  ])
  return CSV_BOM + toCsv([labels.headers, ...body])
}

export function buildExpensesCsv(
  rows: readonly ExpenseExportRow[],
  labels: ExpensesCsvLabels,
): string {
  const body = rows.map((row) => [
    row.expense_date,
    labels.category(row.category),
    formatBDAmount(row.amount_fils),
    row.coach?.full_name ?? null,
    row.description,
  ])
  return CSV_BOM + toCsv([labels.headers, ...body])
}

/** Hands a CSV string to the browser as a file download. */
export function downloadCsv(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
