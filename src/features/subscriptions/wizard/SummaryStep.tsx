import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '@/components/ui/Card'
import { formatDate } from '@/lib/dates'
import { formatDiscountValue } from '@/lib/discounts'
import { useLanguage } from '@/lib/useLanguage'
import { checkDiscount, computePricing, effectiveLocationId, planFor } from '../draft'
import { PriceBreakdown } from '../PriceBreakdown'
import type { StepProps } from './types'

export function SummaryStep({ draft, ctx }: StepProps) {
  const { t } = useTranslation('subscriptions')
  const { language } = useLanguage()
  const pricing = computePricing(draft, ctx)
  const plan = planFor(draft, ctx)
  const discount = checkDiscount(draft, ctx)
  if (!pricing || !plan) return null
  const locationName = ctx.locations.find(
    (location) => location.id === effectiveLocationId(draft, ctx),
  )?.name

  let discountLabel: string | undefined
  if (discount.kind === 'ok') {
    const value = formatDiscountValue(
      discount.pricing.type,
      discount.pricing.type === 'percent' ? discount.pricing.bps : discount.pricing.fils,
      language,
    )
    discountLabel = discount.code
      ? `${t('detail.discountCode', { code: discount.code.code })} · ${value}`
      : t('detail.discountManual', { reason: discount.reason ?? '' })
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>
          {t('detail.title', { plan: t(`plan.${plan.code as 'solo' | 'duo' | 'trio' | 'quad'}`) })}
        </CardTitle>
        <p className="text-ink-muted">{draft.players.map((p) => p.full_name).join(', ')}</p>
        {locationName && (
          <p className="text-ink-muted">
            {t('detail.location')}: <bdi>{locationName}</bdi>
          </p>
        )}
        <p className="text-ink-muted">
          <bdi dir="ltr">
            {formatDate(draft.start)} – {formatDate(draft.end)}
          </bdi>
        </p>
      </Card>
      <Card>
        <PriceBreakdown
          planPriceFils={pricing.planPriceFils}
          tshirtTotalFils={pricing.tshirtTotalFils}
          transportTotalFils={pricing.transportTotalFils}
          discountFils={pricing.discountFils}
          totalFils={pricing.totalFils}
          discountLabel={discountLabel}
        />
      </Card>
    </div>
  )
}
