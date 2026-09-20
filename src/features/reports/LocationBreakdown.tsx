import { useTranslation } from 'react-i18next'
import { formatBDAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { LocationRow } from '@/features/locations/api'
import type { LocationTotals } from './api'

interface LocationBreakdownProps {
  rows: readonly LocationTotals[]
  locations: readonly LocationRow[]
}

/**
 * The period split by location, with a total row that equals the all-locations figures. A row with no location
 * holds what has none yet: older subscriptions and academy-wide expenses. Same layout as the months table so
 * four columns fit a phone.
 */
export function LocationBreakdown({ rows, locations }: LocationBreakdownProps) {
  const { t } = useTranslation(['reports', 'locations'])
  const names = new Map(locations.map((location) => [location.id, location.name]))
  const sorted = [...rows].sort((a, b) => {
    if (a.locationId === null) return 1 // "no location" last
    if (b.locationId === null) return -1
    return (names.get(a.locationId) ?? '').localeCompare(names.get(b.locationId) ?? '')
  })
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
    <div
      className="-mx-1 overflow-x-auto"
      role="region"
      aria-label={t('reports:locations.caption')}
      tabIndex={0}
    >
      <table className="w-full min-w-[19.5rem] text-start text-sm">
        <caption className="sr-only">{t('reports:locations.caption')}</caption>
        <thead className="text-[13px] font-semibold text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-1.5 py-2 text-start">
              {t('reports:locations.location')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('reports:months.collected')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('reports:months.expenses')}
            </th>
            <th scope="col" className="px-1.5 py-2 text-end">
              {t('reports:months.profit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.locationId ?? 'none'} className="border-b border-line/60">
              <th scope="row" className="px-1.5 py-2.5 text-start font-semibold text-ink">
                {row.locationId === null ? (
                  <span className="text-ink-muted">{t('reports:locations.none')}</span>
                ) : (
                  <bdi>{names.get(row.locationId) ?? '—'}</bdi>
                )}
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
              {t('reports:locations.total')}
            </th>
            {amount(totals.collected)}
            {amount(totals.expenses)}
            {amount(totals.profit, totals.profit < 0 ? 'text-danger' : undefined)}
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 px-1.5 text-[13px] text-ink-muted">{t('reports:locations.note')}</p>
    </div>
  )
}
