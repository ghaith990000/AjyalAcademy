import { useTranslation } from 'react-i18next'
import { formatMonthName } from '@/lib/dates'
import { formatBDAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/useLanguage'
import type { MonthRow } from './api'

interface MonthsTableProps {
  rows: readonly MonthRow[]
  /** Month (1–12) to highlight, when the report is showing a single month. */
  highlight?: number
}

/**
 * The year's 12 months as text (the chart's numbers), plus a total row that equals the year's figures. Amounts
 * are plain numbers in BD with the unit in the header, so four columns fit a phone; a loss is red *and* signed.
 */
export function MonthsTable({ rows, highlight }: MonthsTableProps) {
  const { t } = useTranslation('reports')
  const { language } = useLanguage()
  const totals = rows.reduce(
    (sum, row) => ({
      collected: sum.collected + row.collectedFils,
      expenses: sum.expenses + row.expensesFils,
      profit: sum.profit + row.profitFils,
    }),
    { collected: 0, expenses: 0, profit: 0 },
  )

  const amount = (fils: number, className?: string) => (
    <td className={cn('px-1.5 py-2.5 text-end tabular-nums', className)}>
      <bdi dir="ltr">{formatBDAmount(fils)}</bdi>
    </td>
  )

  return (
    // A region that can scroll sideways must be reachable by keyboard, and named.
    <div
      className="-mx-1 overflow-x-auto"
      role="region"
      aria-label={t('months.caption')}
      tabIndex={0}
    >
      <table className="w-full min-w-[19.5rem] text-start text-sm">
        <caption className="sr-only">{t('months.caption')}</caption>
        <thead className="text-[13px] font-semibold text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-1.5 py-2 text-start">
              {t('months.month')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('months.collected')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('months.expenses')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('months.profit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.month}
              aria-current={row.month === highlight ? 'true' : undefined}
              className={cn(
                'border-b border-line/60',
                row.month === highlight && 'bg-brand-blue-50',
              )}
            >
              <th scope="row" className="px-1.5 py-2.5 text-start font-semibold text-ink">
                {formatMonthName(row.month, language)}
              </th>
              {amount(row.collectedFils)}
              {amount(row.expensesFils)}
              {amount(
                row.profitFils,
                cn('font-semibold', row.profitFils < 0 ? 'text-danger' : 'text-ink'),
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold text-ink">
            <th scope="row" className="px-1.5 py-2.5 text-start">
              {t('months.total')}
            </th>
            {amount(totals.collected)}
            {amount(totals.expenses)}
            {amount(totals.profit, totals.profit < 0 ? 'text-danger' : undefined)}
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 px-1.5 text-[13px] text-ink-muted">{t('months.unit')}</p>
    </div>
  )
}
