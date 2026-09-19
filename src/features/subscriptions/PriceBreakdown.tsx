import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Money } from '@/components/ui/Money'
import { cn } from '@/lib/utils'

interface PriceBreakdownProps {
  planPriceFils: number
  tshirtTotalFils: number
  transportTotalFils: number
  discountFils: number
  totalFils: number
  /** e.g. "Code SIBLING10" — shown next to the discount line. */
  discountLabel?: ReactNode
  paidFils?: number
  balanceFils?: number
}

function Line({
  label,
  children,
  strong,
}: {
  label: ReactNode
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4',
        strong && 'text-lg font-extrabold',
      )}
    >
      <dt className={cn('min-w-0', !strong && 'text-ink-muted')}>{label}</dt>
      <dd className="shrink-0 font-semibold">{children}</dd>
    </div>
  )
}

/** Line items → total (and, on a saved subscription, paid and balance). Amounts are integer fils. */
export function PriceBreakdown({
  planPriceFils,
  tshirtTotalFils,
  transportTotalFils,
  discountFils,
  totalFils,
  discountLabel,
  paidFils,
  balanceFils,
}: PriceBreakdownProps) {
  const { t } = useTranslation('subscriptions')
  const showSubtotal = discountFils > 0
  return (
    <dl className="space-y-2.5">
      <Line label={t('detail.breakdown.plan')}>
        <Money fils={planPriceFils} />
      </Line>
      {tshirtTotalFils > 0 && (
        <Line label={t('detail.breakdown.tshirt')}>
          <Money fils={tshirtTotalFils} />
        </Line>
      )}
      {transportTotalFils > 0 && (
        <Line label={t('detail.breakdown.transport')}>
          <Money fils={transportTotalFils} />
        </Line>
      )}
      {showSubtotal && (
        <>
          <Line label={t('detail.breakdown.subtotal')}>
            <Money fils={planPriceFils + tshirtTotalFils + transportTotalFils} />
          </Line>
          <Line
            label={
              <>
                {t('detail.breakdown.discount')}
                {discountLabel && <span className="block text-[13px]">{discountLabel}</span>}
              </>
            }
          >
            <span className="text-success">
              −<Money fils={discountFils} />
            </span>
          </Line>
        </>
      )}
      <div className="border-t border-line pt-2.5">
        <Line label={t('detail.breakdown.total')} strong>
          <Money fils={totalFils} />
        </Line>
      </div>
      {paidFils !== undefined && balanceFils !== undefined && (
        <>
          <Line label={t('detail.breakdown.paid')}>
            <Money fils={paidFils} />
          </Line>
          <Line label={t('detail.breakdown.balance')}>
            <span className={cn(balanceFils > 0 ? 'text-danger' : 'text-success')}>
              <Money fils={balanceFils} />
            </span>
          </Line>
        </>
      )}
    </dl>
  )
}
