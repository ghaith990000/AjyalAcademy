import { Ban, ChevronLeft, CloudOff, CreditCard, Plus, ReceiptText, Shirt, Bus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePlayersBasePath } from '@/features/players/hooks'
import { formatDate } from '@/lib/dates'
import { formatDiscountValue } from '@/lib/discounts'
import { useLanguage } from '@/lib/useLanguage'
import { AddPaymentDialog } from './AddPaymentDialog'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import {
  useDiscountLabel,
  useSubscription,
  useSubscriptionPayments,
  useSubscriptionPlayers,
  useSubscriptionsBasePath,
} from './hooks'
import { PriceBreakdown } from './PriceBreakdown'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

type PlanCode = 'solo' | 'duo' | 'trio' | 'quad'

export default function SubscriptionDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['subscriptions', 'common'])
  const { language } = useLanguage()
  const base = useSubscriptionsBasePath()
  const playersBase = usePlayersBasePath()
  const subscription = useSubscription(id)
  const players = useSubscriptionPlayers(id)
  const payments = useSubscriptionPayments(id)
  const discountId = subscription.data?.discount_id ?? null
  const discountLabel = useDiscountLabel(discountId)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const back = (
    <Link
      to={base}
      className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-control pe-3 font-semibold text-brand-blue hover:underline"
    >
      <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
      {t('subscriptions:detail.back')}
    </Link>
  )

  if (subscription.isPending) {
    return (
      <>
        {back}
        <div aria-busy className="space-y-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      </>
    )
  }
  if (subscription.isError) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('subscriptions:detail.loadError.title')}
            description={t('subscriptions:detail.loadError.description')}
            action={
              <Button onClick={() => void subscription.refetch()}>
                {t('common:actions.retry')}
              </Button>
            }
          />
        </Card>
      </>
    )
  }
  const sub = subscription.data
  if (!sub) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={Ban}
            title={t('subscriptions:detail.notFound.title')}
            description={t('subscriptions:detail.notFound.description')}
          />
        </Card>
      </>
    )
  }

  const cancelled = sub.status === 'cancelled'
  const planName = t(`subscriptions:plan.${sub.plan_code as PlanCode}`)
  const visible = players.data?.filter((row) => row.player) ?? []
  const hiddenCount = (players.data?.length ?? 0) - visible.length

  let discountText: string | undefined
  if (sub.discount_id) {
    const value =
      sub.discount_type && sub.discount_value !== null
        ? formatDiscountValue(sub.discount_type, sub.discount_value, language)
        : ''
    const code = discountLabel.data?.code
    discountText = code ? `${t('subscriptions:detail.discountCode', { code })} · ${value}` : value
  } else if (sub.discount_reason) {
    discountText = t('subscriptions:detail.discountManual', { reason: sub.discount_reason })
  }

  return (
    <>
      {back}

      <div className="space-y-4">
        <Card className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-ink">
                {t('subscriptions:detail.title', { plan: planName })}
              </h1>
              <SubscriptionStatusBadge status={sub.status} />
            </div>
            <p className="mt-1 text-ink-muted">
              <bdi dir="ltr">
                {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
              </bdi>
            </p>
          </div>
          {!cancelled && (
            <div className="flex flex-wrap gap-2">
              {sub.balance_fils > 0 && (
                <Button onClick={() => setPaying(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t('subscriptions:detail.addPayment')}
                </Button>
              )}
              <Button variant="danger" onClick={() => setCancelling(true)}>
                {t('subscriptions:detail.cancel')}
              </Button>
            </div>
          )}
        </Card>

        {cancelled && (
          <Card className="border-danger/40 bg-danger-50">
            <p className="font-semibold text-danger">
              {t('subscriptions:detail.cancelledOn', {
                date: formatDate(sub.cancelled_at!.slice(0, 10)),
              })}
            </p>
            {sub.cancel_reason && (
              <p dir="auto" className="mt-1 break-words">
                {t('subscriptions:detail.cancelReason', { reason: sub.cancel_reason })}
              </p>
            )}
          </Card>
        )}

        <Card>
          <CardTitle>{t('subscriptions:detail.players')}</CardTitle>
          <ul className="mt-3 divide-y divide-line">
            {visible.map((row) => (
              <li
                key={row.player_id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <Link
                  to={`${playersBase}/${row.player_id}`}
                  className="inline-flex min-h-11 min-w-0 items-center break-words font-semibold text-brand-blue hover:underline"
                >
                  {row.player?.full_name}
                </Link>
                <span className="flex flex-wrap gap-2">
                  {row.tshirt_fee_fils > 0 && (
                    <Badge tone="info">
                      <Shirt className="size-3.5" aria-hidden />
                      {t('subscriptions:detail.tshirt')} · <Money fils={row.tshirt_fee_fils} />
                    </Badge>
                  )}
                  {row.transport_fee_fils > 0 && (
                    <Badge tone="info">
                      <Bus className="size-3.5" aria-hidden />
                      {t('subscriptions:detail.transport')} ·{' '}
                      <Money fils={row.transport_fee_fils} />
                    </Badge>
                  )}
                </span>
              </li>
            ))}
            {hiddenCount > 0 && (
              <li className="py-3 text-ink-muted">
                {t('subscriptions:hiddenPlayers', { n: hiddenCount })}
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t('subscriptions:detail.breakdown.title')}</CardTitle>
          <div className="mt-4">
            <PriceBreakdown
              planPriceFils={sub.plan_price_fils}
              tshirtTotalFils={sub.tshirt_total_fils}
              transportTotalFils={sub.transport_total_fils}
              discountFils={sub.discount_fils}
              totalFils={sub.total_fils}
              discountLabel={discountText}
              paidFils={sub.paid_fils}
              balanceFils={sub.balance_fils}
            />
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-brand-blue" aria-hidden />
              {t('subscriptions:detail.payments.title')}
            </CardTitle>
            {!cancelled && sub.balance_fils === 0 && sub.total_fils > 0 && (
              <Badge tone="success">{t('subscriptions:detail.settled')}</Badge>
            )}
          </div>
          {payments.data && payments.data.length > 0 ? (
            <ul className="mt-3 divide-y divide-line">
              {payments.data.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <Money fils={payment.amount_fils} />
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      <bdi dir="ltr">{formatDate(payment.paid_at)}</bdi> ·{' '}
                      {t(`subscriptions:methods.${payment.method}`)}
                      {payment.received &&
                        ` · ${t('subscriptions:detail.payments.receivedBy', { name: payment.received.full_name })}`}
                    </p>
                    {payment.note && (
                      <p dir="auto" className="mt-0.5 break-words text-[15px]">
                        {payment.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-ink-muted">
              <ReceiptText className="size-5" aria-hidden />
              {t('subscriptions:detail.payments.empty')}
            </p>
          )}
        </Card>
      </div>

      {paying && <AddPaymentDialog subscription={sub} onClose={() => setPaying(false)} />}
      {cancelling && (
        <CancelSubscriptionDialog subscription={sub} onClose={() => setCancelling(false)} />
      )}
    </>
  )
}
