import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui/IconButton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { formatMonthYear } from '@/lib/dates'
import {
  isLatestPeriod,
  shiftPeriod,
  switchKind,
  type Period,
  type PeriodKind,
} from '@/lib/reports'
import { useLanguage } from '@/lib/useLanguage'

interface PeriodSwitcherProps {
  period: Period
  onChange: (period: Period) => void
  /** Offer the month | year switch (reports). The expenses page and the salary dialog are month-only. */
  kinds?: boolean
}

/** Previous / next month or year, never beyond the current one; optionally with a month | year switch. */
export function PeriodSwitcher({ period, onChange, kinds = false }: PeriodSwitcherProps) {
  const { t } = useTranslation('reports')
  const { language } = useLanguage()
  const label =
    period.kind === 'month' ? formatMonthYear(period.year, period.month, language) : period.year
  const atLatest = isLatestPeriod(period)

  return (
    <div className="space-y-3">
      {kinds && (
        <Tabs
          value={period.kind}
          onValueChange={(kind) => onChange(switchKind(period, kind as PeriodKind))}
        >
          <TabsList aria-label={t('period.label')}>
            <TabsTrigger value="month">{t('period.month')}</TabsTrigger>
            <TabsTrigger value="year">{t('period.year')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className="flex items-center justify-between gap-2 rounded-card border border-line bg-surface p-1.5 shadow-card">
        <IconButton
          label={t(period.kind === 'month' ? 'period.previousMonth' : 'period.previousYear')}
          icon={<ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />}
          onClick={() => onChange(shiftPeriod(period, -1))}
        />
        <p aria-live="polite" className="min-w-0 truncate text-center text-lg font-bold text-ink">
          <bdi>{label}</bdi>
        </p>
        <IconButton
          label={t(period.kind === 'month' ? 'period.nextMonth' : 'period.nextYear')}
          icon={<ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />}
          disabled={atLatest}
          onClick={() => onChange(shiftPeriod(period, 1))}
        />
      </div>
    </div>
  )
}
