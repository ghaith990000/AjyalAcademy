import { useTranslation } from 'react-i18next'
import { Money } from '@/components/ui/Money'
import { sharePercent } from '@/lib/reports'
import type { CategoryTotal } from './api'

/** Each category's share of the period's expenses: name, amount, percent, and a bar (the bar is decoration). */
export function CategoryBreakdown({ totals }: { totals: readonly CategoryTotal[] }) {
  const { t } = useTranslation(['reports', 'expenses'])
  const total = totals.reduce((sum, entry) => sum + entry.totalFils, 0)

  if (totals.length === 0) {
    return <p className="text-ink-muted">{t('reports:categories.empty')}</p>
  }

  return (
    <ul className="space-y-4">
      {totals.map((entry) => {
        const share = sharePercent(entry.totalFils, total)
        return (
          <li key={entry.category}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 font-semibold text-ink">
                {t(`expenses:category.${entry.category}`)}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-ink">
                <Money fils={entry.totalFils} />
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-brand-pink-50">
                <div className="h-full rounded-full bg-brand-pink" style={{ width: `${share}%` }} />
              </div>
              <span className="w-10 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
                <bdi dir="ltr">{share}%</bdi>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
