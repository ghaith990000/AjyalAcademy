/**
 * Pure helpers for the finance reports: margin, periods (a calendar month or year) and CSV building.
 * The report figures themselves come from the database (`report_summary` & co.); see docs/05-business-rules.md.
 */
import type { Language } from './i18n'

export type PeriodKind = 'month' | 'year'
export type Period = { kind: 'month'; year: number; month: number } | { kind: 'year'; year: number }

export interface DateRange {
  /** "yyyy-MM-dd", inclusive */
  from: string
  /** "yyyy-MM-dd", inclusive */
  to: string
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * profit ÷ collected in basis points (61.11% = 6111), rounded half away from zero exactly like the database's
 * `report_summary`; `null` when nothing was collected (shown as "—").
 */
export function marginBps(profitFils: number, collectedFils: number): number | null {
  if (collectedFils <= 0) return null
  const rounded = Math.floor(
    (2 * Math.abs(profitFils) * 10_000 + collectedFils) / (2 * collectedFils),
  )
  return profitFils < 0 ? -rounded : rounded
}

/** 6111 → "61.11%" / "61.11٪"; `null` → "—". Latin digits in both languages. */
export function formatMargin(bps: number | null, language: Language): string {
  if (bps === null) return '—'
  return `${(bps / 100).toFixed(2)}${language === 'ar' ? '٪' : '%'}`
}

/** A part's whole-percent share of a total (half up); 0 when the total is 0. */
export function sharePercent(partFils: number, totalFils: number): number {
  return totalFils > 0 ? Math.round((partFils * 100) / totalFils) : 0
}

export function currentPeriod(kind: PeriodKind, now: Date = new Date()): Period {
  return kind === 'month'
    ? { kind, year: now.getFullYear(), month: now.getMonth() + 1 }
    : { kind, year: now.getFullYear() }
}

export function periodRange(period: Period): DateRange {
  if (period.kind === 'year') return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
  const lastDay = new Date(period.year, period.month, 0).getDate()
  const month = `${period.year}-${pad(period.month)}`
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` }
}

/** The previous (−1) or next (+1) month / year. */
export function shiftPeriod(period: Period, delta: -1 | 1): Period {
  if (period.kind === 'year') return { kind: 'year', year: period.year + delta }
  const index = period.year * 12 + (period.month - 1) + delta
  return { kind: 'month', year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** Month ⇄ year keeping the year; going to a month picks the latest month that has begun (never a future one). */
export function switchKind(period: Period, kind: PeriodKind, now: Date = new Date()): Period {
  if (period.kind === kind) return period
  if (kind === 'year') return { kind: 'year', year: period.year }
  const month =
    period.year < now.getFullYear()
      ? 12
      : period.year === now.getFullYear()
        ? now.getMonth() + 1
        : 1
  return { kind: 'month', year: period.year, month }
}

/** True when the period after this one has not begun yet — nothing to look at there. */
export function isLatestPeriod(period: Period, now: Date = new Date()): boolean {
  const next = periodRange(shiftPeriod(period, 1)).from
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return next > today
}

export function periodKey(period: Period): string {
  return period.kind === 'year' ? String(period.year) : `${period.year}-${pad(period.month)}`
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export type CsvCell = string | number | null

/** Excel and Sheets run a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One CSV field. Text a person typed (names, notes) could begin with `=`/`+`/`-`/`@` and be executed as a
 * formula when the file is opened, so such text gets a leading apostrophe; numbers are written as they are.
 */
export function csvCell(value: CsvCell): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Rows → CSV text (CRLF line ends, as spreadsheet programs expect). */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Excel only reads UTF-8 (so Arabic survives) when the file starts with a byte-order mark. */
export const CSV_BOM = '\uFEFF'

/** "ajyal-payments-2026-10.csv" / "ajyal-expenses-2026.csv" */
export function csvFileName(kind: 'payments' | 'expenses', period: Period): string {
  return `ajyal-${kind}-${periodKey(period)}.csv`
}
