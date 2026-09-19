import { CalendarDays, CreditCard, TrendingUp, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HeroCard } from '@/components/ui/HeroCard'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { useActivityRealtime } from '@/features/activity/hooks'
import { useAuth } from '@/features/auth/useAuth'
import { useReportSummary } from '@/features/reports/hooks'
import { useTodaySessions } from '@/features/sessions/hooks'
import { formatLongDate } from '@/lib/dates'
import { currentPeriod, formatMargin, periodRange } from '@/lib/reports'
import { useLanguage } from '@/lib/useLanguage'
import { ExpiringSubscriptions } from './ExpiringSubscriptions'
import { useActiveSubscriptionsCount, usePlayersCount } from './hooks'
import { QuickActions } from './QuickActions'
import { TodaySessions } from './TodaySessions'

/** A figure, a placeholder while it loads, or a dash when it could not be read. */
function figure(query: { isPending: boolean; data?: number }, render: (n: number) => ReactNode) {
  if (query.isPending) return <Skeleton className="h-7 w-20" aria-busy />
  return query.data === undefined ? '—' : render(query.data)
}

function AdminStats() {
  const { t } = useTranslation('home')
  const { language } = useLanguage()
  const players = usePlayersCount()
  const subscriptions = useActiveSubscriptionsCount({ enabled: true })
  // The very same query as the Reports page for the current month, so the two always agree.
  const summary = useReportSummary(periodRange(currentPeriod('month')))
  const s = summary.data

  return (
    <>
      <StatCard
        compact
        label={t('stats.activePlayers')}
        value={figure(players, String)}
        icon={Users}
      />
      <StatCard
        compact
        label={t('stats.activeSubscriptions')}
        value={figure(subscriptions, String)}
        icon={CreditCard}
        tone="pink"
      />
      <StatCard
        compact
        label={t('stats.collectedThisMonth')}
        value={
          summary.isPending ? (
            <Skeleton className="h-7 w-24" aria-busy />
          ) : s ? (
            <Money fils={s.collectedFils} />
          ) : (
            '—'
          )
        }
        icon={Wallet}
        tone="success"
      />
      <StatCard
        compact
        label={t('stats.netProfit')}
        value={
          summary.isPending ? (
            <Skeleton className="h-7 w-24" aria-busy />
          ) : s ? (
            <span className={s.profitFils < 0 ? 'text-danger' : undefined}>
              <Money fils={s.profitFils} />
            </span>
          ) : (
            '—'
          )
        }
        hint={s ? t('stats.margin', { margin: formatMargin(s.marginBps, language) }) : undefined}
        icon={TrendingUp}
        tone="warning"
      />
    </>
  )
}

function CoachStats() {
  const { t } = useTranslation('home')
  const players = usePlayersCount()
  const today = useTodaySessions()
  return (
    <>
      <StatCard compact label={t('stats.myPlayers')} value={figure(players, String)} icon={Users} />
      <StatCard
        compact
        label={t('stats.todaySessions')}
        value={figure({ isPending: today.isPending, data: today.data?.length }, String)}
        icon={CalendarDays}
        tone="pink"
      />
    </>
  )
}

/** The daily control panel: what to do now, the numbers that matter, today's sessions and the live feed. */
export default function HomePage({ role }: { role: 'admin' | 'coach' }) {
  const { t } = useTranslation(['home', 'common'])
  const { language } = useLanguage()
  const { profile } = useAuth()
  const live = useActivityRealtime()
  const base = role === 'admin' ? '/admin' : '/coach'
  const firstName = profile?.full_name.trim().split(/\s+/)[0] ?? ''

  return (
    <div className="space-y-5">
      <HeroCard>
        <p className="text-sm font-medium text-white/80">{formatLongDate(new Date(), language)}</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">
          {t('home:welcome', { name: firstName })}
        </h1>
        <p className="mt-1 max-w-md text-white/80">{t('common:app.tagline')}</p>
      </HeroCard>

      <QuickActions base={base} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {role === 'admin' ? <AdminStats /> : <CoachStats />}
      </div>

      {/* `grid-cols-1` is minmax(0, 1fr): without it a wide child (the scrolling chips) would stretch the column. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-5">
          <TodaySessions base={base} showCoach={role === 'admin'} />
          <ExpiringSubscriptions base={base} />
        </div>
        <ActivityFeed role={role} live={live} />
      </div>
    </div>
  )
}
