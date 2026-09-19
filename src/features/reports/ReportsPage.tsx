import {
  ChartColumn,
  CloudOff,
  HandCoins,
  Percent,
  Receipt,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { currentPeriod, formatMargin, periodRange, type Period } from '@/lib/reports'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/useLanguage'
import { CategoryBreakdown } from './CategoryBreakdown'
import { ExportCard } from './ExportCard'
import { useExpensesByCategory, useReportSummary, useRevenueByMonth } from './hooks'
import { MonthsTable } from './MonthsTable'
import { PeriodSwitcher } from './PeriodSwitcher'
import { RevenueChart } from './RevenueChart'

function Kpi({
  label,
  icon: Icon,
  negative = false,
  children,
}: {
  label: string
  icon: LucideIcon
  /** A loss: the value turns red (it also carries a minus sign, so colour is never the only cue). */
  negative?: boolean
  children: ReactNode
}) {
  return (
    <Card className="p-3.5 md:p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 break-words text-lg font-extrabold tabular-nums md:text-2xl',
          negative ? 'text-danger' : 'text-ink',
        )}
      >
        {children}
      </p>
    </Card>
  )
}

export default function ReportsPage() {
  const { t } = useTranslation(['reports', 'nav', 'common'])
  const { language } = useLanguage()
  const [period, setPeriod] = useState<Period>(() => currentPeriod('month'))
  const range = periodRange(period)
  const summary = useReportSummary(range)
  const months = useRevenueByMonth(period.year)
  const categories = useExpensesByCategory(range)

  const s = summary.data
  const yearHasData = months.data?.some((row) => row.collectedFils > 0 || row.expensesFils > 0)

  return (
    <>
      <PageHeader title={t('nav:reports')} description={t('reports:description')} />
      <div className="space-y-4">
        <PeriodSwitcher period={period} onChange={setPeriod} kinds />

        {summary.isError ? (
          <Card>
            <EmptyState
              icon={CloudOff}
              title={t('reports:loadError.title')}
              description={t('reports:loadError.description')}
              action={
                <Button onClick={() => void summary.refetch()}>{t('common:actions.retry')}</Button>
              }
            />
          </Card>
        ) : (
          <section
            aria-label={t('reports:kpi.label')}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {s ? (
              <>
                <Kpi label={t('reports:kpi.collected')} icon={HandCoins}>
                  <Money fils={s.collectedFils} />
                </Kpi>
                <Kpi label={t('reports:kpi.expenses')} icon={Receipt}>
                  <Money fils={s.expensesFils} />
                </Kpi>
                <Kpi label={t('reports:kpi.profit')} icon={TrendingUp} negative={s.profitFils < 0}>
                  <Money fils={s.profitFils} />
                </Kpi>
                <Kpi
                  label={t('reports:kpi.margin')}
                  icon={Percent}
                  negative={(s.marginBps ?? 0) < 0}
                >
                  <bdi dir="ltr">{formatMargin(s.marginBps, language)}</bdi>
                </Kpi>
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-card" />
              ))
            )}
          </section>
        )}

        <Card className="space-y-3">
          <CardTitle>{t('reports:chart.title', { year: period.year })}</CardTitle>
          {months.isError ? (
            <EmptyState
              icon={CloudOff}
              title={t('reports:loadError.title')}
              description={t('reports:loadError.description')}
              action={
                <Button onClick={() => void months.refetch()}>{t('common:actions.retry')}</Button>
              }
            />
          ) : !months.data ? (
            <Skeleton className="h-64 w-full rounded-control" />
          ) : yearHasData ? (
            <RevenueChart rows={months.data} year={period.year} />
          ) : (
            <EmptyState
              icon={ChartColumn}
              title={t('reports:chart.empty.title', { year: period.year })}
              description={t('reports:chart.empty.description')}
            />
          )}
        </Card>

        <Card className="space-y-4">
          <CardTitle>{t('reports:categories.title')}</CardTitle>
          {categories.isError ? (
            <p className="text-danger">{t('reports:loadError.title')}</p>
          ) : categories.data ? (
            <CategoryBreakdown totals={categories.data} />
          ) : (
            <Skeleton className="h-24 w-full rounded-control" />
          )}
        </Card>

        <Card className="space-y-3">
          <CardTitle>{t('reports:months.title', { year: period.year })}</CardTitle>
          {months.data ? (
            <MonthsTable
              rows={months.data}
              highlight={period.kind === 'month' ? period.month : undefined}
            />
          ) : months.isError ? (
            <p className="text-danger">{t('reports:loadError.title')}</p>
          ) : (
            <Skeleton className="h-64 w-full rounded-control" />
          )}
        </Card>

        <ExportCard period={period} />
      </div>
    </>
  )
}
