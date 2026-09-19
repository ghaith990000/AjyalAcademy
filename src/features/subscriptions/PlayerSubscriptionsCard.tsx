import { CreditCard, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/dates'
import { usePlayerSubscriptions, useSubscriptionsBasePath } from './hooks'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

/** A player's subscription history on their detail page, with a shortcut to start a new one. */
export function PlayerSubscriptionsCard({ playerId }: { playerId: string }) {
  const { t } = useTranslation('subscriptions')
  const base = useSubscriptionsBasePath()
  const { data, isPending } = usePlayerSubscriptions(playerId)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-brand-blue" aria-hidden />
          {t('player.title')}
        </CardTitle>
        <Button asChild variant="secondary">
          <Link to={`${base}/new?player=${playerId}`}>
            <Plus className="size-4" aria-hidden />
            {t('player.new')}
          </Link>
        </Button>
      </div>
      {isPending ? (
        <Skeleton className="mt-3 h-16 w-full rounded-card" />
      ) : data && data.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {data.map((subscription) => (
            <li key={subscription.id}>
              <Link
                to={`${base}/${subscription.id}`}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-2 hover:bg-brand-blue-50/60"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {t(`plan.${subscription.plan_code as 'solo' | 'duo' | 'trio' | 'quad'}`)}
                    {' · '}
                    <Money fils={subscription.total_fils} />
                  </span>
                  <span dir="ltr" className="block text-start text-[13px] text-ink-muted">
                    {formatDate(subscription.start_date)} – {formatDate(subscription.end_date)}
                  </span>
                </span>
                <SubscriptionStatusBadge status={subscription.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ink-muted">{t('player.none')}</p>
      )}
    </Card>
  )
}
