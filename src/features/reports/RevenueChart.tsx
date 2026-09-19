import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { Money } from '@/components/ui/Money'
import { formatMonthName } from '@/lib/dates'
import { toBD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'
import type { MonthRow } from './api'

// Series colours are the brand tokens (docs/06-design-system.md → Charts): revenue blue, expenses pink,
// profit the success green.
const COLLECTED = 'var(--color-brand-blue)'
const EXPENSES = 'var(--color-brand-pink)'
const PROFIT = 'var(--color-success)'

// Bars for the two money series, a line for profit: the shapes differ as well as the colours.
const LEGEND = [
  { key: 'collected', color: COLLECTED, shape: 'size-3 rounded-sm' },
  { key: 'expenses', color: EXPENSES, shape: 'size-3 rounded-sm' },
  { key: 'profit', color: PROFIT, shape: 'h-1 w-4 rounded-full' },
] as const

interface ChartDatum {
  month: number
  collected: number
  expenses: number
  profit: number
  row: MonthRow
}

function MonthTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useTranslation('reports')
  const { language, rtl } = useLanguage()
  const row = (active ? payload[0]?.payload : undefined) as ChartDatum | undefined
  if (!row) return null
  const lines = [
    { label: t('chart.collected'), fils: row.row.collectedFils },
    { label: t('chart.expenses'), fils: row.row.expensesFils },
    { label: t('chart.profit'), fils: row.row.profitFils },
  ]
  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className="rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-float"
    >
      <p className="mb-1 font-bold text-ink">{formatMonthName(row.month, language)}</p>
      {lines.map((line) => (
        <p key={line.label} className="flex justify-between gap-4 text-ink">
          <span className="text-ink-muted">{line.label}</span>
          <span className="font-semibold">
            <Money fils={line.fils} />
          </span>
        </p>
      ))}
    </div>
  )
}

interface RevenueChartProps {
  rows: readonly MonthRow[]
  year: number
}

/**
 * Collected and expenses per month as bars, profit as a line. The time axis stays left-to-right in both
 * languages (docs/06-design-system.md); the month table below the chart carries the same numbers as text.
 */
export function RevenueChart({ rows, year }: RevenueChartProps) {
  const { t } = useTranslation('reports')
  const data: ChartDatum[] = rows.map((row) => ({
    month: row.month,
    // Chart geometry only — every figure shown as text is read from `row` in integer fils.
    collected: toBD(row.collectedFils),
    expenses: toBD(row.expensesFils),
    profit: toBD(row.profitFils),
    row,
  }))

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1" aria-hidden>
        {LEGEND.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[13px] text-ink">
            <span
              className={`inline-block ${item.shape}`}
              style={{ backgroundColor: item.color }}
            />
            {t(`chart.${item.key}`)}
          </li>
        ))}
      </ul>
      <div dir="ltr" role="img" aria-label={t('chart.aria', { year })} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line)' }}
              tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
              tickFormatter={(value: number) => String(Math.round(value))}
            />
            <Tooltip content={MonthTooltip} cursor={{ fill: 'var(--color-brand-blue-50)' }} />
            <Bar
              dataKey="collected"
              fill={COLLECTED}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenses"
              fill={EXPENSES}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Line
              dataKey="profit"
              type="monotone"
              stroke={PROFIT}
              strokeWidth={2.5}
              dot={{ r: 3, fill: PROFIT, stroke: PROFIT }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-[13px] text-ink-muted">{t('chart.axisHint')}</p>
    </div>
  )
}
