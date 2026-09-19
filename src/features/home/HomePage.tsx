import { Bell, CalendarDays, CreditCard, TrendingUp, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCard } from '@/components/ui/HeroCard'
import { StatCard } from '@/components/ui/StatCard'
import { formatLongDate } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'

/** Home layout preview. Real KPIs and the live activity feed arrive in Phase 7 (values show "—"). */
export default function HomePage({ role }: { role: 'admin' | 'coach' }) {
  const { t } = useTranslation(['home', 'common'])
  const { language } = useLanguage()

  return (
    <div className="space-y-5">
      <HeroCard>
        <p className="text-sm font-medium text-white/80">{formatLongDate(new Date(), language)}</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{t('home:welcome')}</h1>
        <p className="mt-1 max-w-md text-white/80">{t('common:app.tagline')}</p>
      </HeroCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {role === 'admin' ? (
          <>
            <StatCard label={t('home:stats.activePlayers')} value="—" icon={Users} />
            <StatCard
              label={t('home:stats.activeSubscriptions')}
              value="—"
              icon={CreditCard}
              tone="pink"
            />
            <StatCard
              label={t('home:stats.collectedThisMonth')}
              value="—"
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label={t('home:stats.netProfit')}
              value="—"
              icon={TrendingUp}
              tone="warning"
            />
          </>
        ) : (
          <>
            <StatCard label={t('home:stats.myPlayers')} value="—" icon={Users} />
            <StatCard
              label={t('home:stats.todaySessions')}
              value="—"
              icon={CalendarDays}
              tone="pink"
            />
          </>
        )}
      </div>

      <Card>
        <CardTitle>{t('home:feed.title')}</CardTitle>
        <EmptyState
          icon={Bell}
          title={t('home:feed.emptyTitle')}
          description={t('home:feed.emptyDescription')}
        />
      </Card>
    </div>
  )
}
