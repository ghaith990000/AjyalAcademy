import { differenceInCalendarDays, parseISO } from 'date-fns'
import { CloudOff, CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRelative, todayISO } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { useExpiringSubscriptions } from './hooks'

/** Subscriptions about to end, soonest first; one with money still owed is flagged so it can be chased. */
export function ExpiringSubscriptions({ base }: { base: '/admin' | '/coach' }) {
  const { t } = useTranslation(['home', 'subscriptions', 'common'])
  const { language } = useLanguage()
  const expiring = useExpiringSubscriptions()

  let body
  if (expiring.isPending) {
    body = <Skeleton className="h-20 w-full rounded-control" aria-busy />
  } else if (expiring.isError) {
    body = (
      <EmptyState
        icon={CloudOff}
        title={t('home:expiring.loadError')}
        action={
          <Button onClick={() => void expiring.refetch()}>{t('common:actions.retry')}</Button>
        }
      />
    )
  } else if (expiring.data.rows.length === 0) {
    body = (
      <EmptyState
        icon={CreditCard}
        title={t('home:expiring.empty.title')}
        description={t('home:expiring.empty.description')}
      />
    )
  } else {
    const { rows, total } = expiring.data
    body = (
      <>
        <ul className="space-y-3">
          {rows.map((row) => {
            const daysLeft = differenceInCalendarDays(parseISO(row.end_date), parseISO(todayISO()))
            return (
              <li key={row.id}>
                <Link
                  to={`${base}/subscriptions/${row.id}`}
                  className="block min-h-14 space-y-1 rounded-control border border-line p-3 hover:bg-brand-blue-50/60"
                >
                  <span dir="auto" className="block break-words font-bold text-ink">
                    {row.player_names}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-muted">
                    <span>
                      {t(`subscriptions:plan.${row.plan_code}` as 'subscriptions:plan.solo', {
                        defaultValue: row.plan_code,
                      })}
                    </span>
                    <span>
                      {t('home:expiring.ends', { when: formatRelative(daysLeft, 'day', language) })}
                    </span>
                    {row.balance_fils > 0 && (
                      <Badge tone="warning">
                        {t('home:expiring.unpaid')}: <Money fils={row.balance_fils} />
                      </Badge>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        {total > rows.length && (
          <p className="text-center text-[13px] text-ink-muted">
            {t('home:expiring.showing', { shown: rows.length, total })}
          </p>
        )}
      </>
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('home:expiring.title')}</CardTitle>
        <Link
          to={`${base}/subscriptions`}
          className="inline-flex min-h-11 items-center px-1 font-semibold text-brand-blue"
        >
          {t('home:expiring.viewAll')}
        </Link>
      </div>
      {body}
    </Card>
  )
}
