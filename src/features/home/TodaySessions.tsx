import { CalendarDays, CloudOff, MapPin, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { canTakeAttendance, sessionStatus } from '@/features/sessions/schedule'
import { SessionStatusBadge } from '@/features/sessions/SessionStatusBadge'
import { useTodaySessions } from '@/features/sessions/hooks'
import { formatTimeRange } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'

/** Today's not-cancelled sessions with a one-tap way to their attendance screen. */
export function TodaySessions({
  base,
  showCoach,
}: {
  base: '/admin' | '/coach'
  showCoach: boolean
}) {
  const { t } = useTranslation(['home', 'common'])
  const { language } = useLanguage()
  const sessions = useTodaySessions()

  let body
  if (sessions.isPending) {
    body = <Skeleton className="h-20 w-full rounded-control" aria-busy />
  } else if (sessions.isError) {
    body = (
      <EmptyState
        icon={CloudOff}
        title={t('home:sessions.loadError')}
        action={
          <Button onClick={() => void sessions.refetch()}>{t('common:actions.retry')}</Button>
        }
      />
    )
  } else if (sessions.data.length === 0) {
    body = (
      <EmptyState
        icon={CalendarDays}
        title={t('home:sessions.empty.title')}
        description={t('home:sessions.empty.description')}
      />
    )
  } else {
    body = (
      <ul className="space-y-3">
        {sessions.data.map((session) => (
          <li key={session.id} className="rounded-control border border-line">
            <Link
              to={`${base}/sessions/${session.id}`}
              className="block min-h-14 space-y-1 rounded-control p-3 hover:bg-brand-blue-50/60"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold text-ink">
                  <bdi>{formatTimeRange(session.start_time, session.end_time, language)}</bdi>
                </span>
                <SessionStatusBadge status={sessionStatus(session)} />
              </span>
              {showCoach && session.coach && (
                <span className="flex items-center gap-1.5 text-[15px] text-ink-muted">
                  <UserRound className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{session.coach.full_name}</span>
                </span>
              )}
              {session.location && (
                <span className="flex items-center gap-1.5 text-[15px] text-ink-muted">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <span dir="auto" className="min-w-0 break-words">
                    {session.location.name}
                  </span>
                </span>
              )}
            </Link>
            {canTakeAttendance(session) && (
              <div className="border-t border-line p-2">
                <Button asChild fullWidth>
                  <Link to={`${base}/sessions/${session.id}/attendance`}>
                    {t('home:sessions.takeAttendance')}
                  </Link>
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('home:sessions.title')}</CardTitle>
        <Link
          to={`${base}/sessions`}
          className="inline-flex min-h-11 items-center px-1 font-semibold text-brand-blue"
        >
          {t('home:sessions.viewAll')}
        </Link>
      </div>
      {body}
    </Card>
  )
}
