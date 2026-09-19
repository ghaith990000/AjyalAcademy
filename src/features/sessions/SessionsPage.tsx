import { addDays } from 'date-fns'
import { CalendarDays, CloudOff, MapPin, Plus, SearchX, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { useCoaches } from '@/features/coaches/hooks'
import { formatDate, formatLongDate, formatTimeRange, todayISO } from '@/lib/dates'
import type { Language } from '@/lib/i18n'
import { useLanguage } from '@/lib/useLanguage'
import { DEFAULT_SESSION_FILTERS, type SessionFilters, type SessionRow } from './api'
import { useSessionsBasePath, useSessionsList } from './hooks'
import { canTakeAttendance, groupByDate, sessionStatus, SESSION_STATUSES } from './schedule'
import { SessionFormDialog } from './SessionFormDialog'
import { SessionStatusBadge } from './SessionStatusBadge'

function SessionCard({ session, showCoach }: { session: SessionRow; showCoach: boolean }) {
  const { t } = useTranslation('sessions')
  const { language } = useLanguage()
  const base = useSessionsBasePath()
  const status = sessionStatus(session)

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <Link
        to={`${base}/${session.id}`}
        className="block min-h-14 space-y-1.5 p-3.5 hover:bg-brand-blue-50/60"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-bold text-ink">
            <bdi>{formatTimeRange(session.start_time, session.end_time, language)}</bdi>
          </span>
          <SessionStatusBadge status={status} />
        </span>
        {showCoach && session.coach && (
          <span className="flex items-center gap-1.5 text-[15px] text-ink-muted">
            <UserRound className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              {t('list.coach', { name: session.coach.full_name })}
            </span>
          </span>
        )}
        {session.location && (
          <span className="flex items-center gap-1.5 text-[15px] text-ink-muted">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words" dir="auto">
              {session.location}
            </span>
          </span>
        )}
      </Link>
      {canTakeAttendance(session) && (
        <div className="border-t border-line px-3.5 py-2">
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link to={`${base}/${session.id}/attendance`}>{t('list.takeAttendance')}</Link>
          </Button>
        </div>
      )}
    </li>
  )
}

function dayHeading(
  date: string,
  language: Language,
  names: { today: string; tomorrow: string },
): string {
  if (date === todayISO()) return names.today
  if (date === todayISO(addDays(new Date(), 1))) return names.tomorrow
  return formatLongDate(date, language)
}

export default function SessionsPage() {
  const { t } = useTranslation(['sessions', 'nav', 'common'])
  const { language } = useLanguage()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const coaches = useCoaches({ enabled: isAdmin })

  const [status, setStatus] = useState<SessionFilters['status']>(DEFAULT_SESSION_FILTERS.status)
  const [coachId, setCoachId] = useState(DEFAULT_SESSION_FILTERS.coachId)
  const [scheduling, setScheduling] = useState(false)
  const filters: SessionFilters = { status, coachId }
  const {
    rows,
    total,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useSessionsList(filters)
  const filtered =
    status !== DEFAULT_SESSION_FILTERS.status || coachId !== DEFAULT_SESSION_FILTERS.coachId

  function clearFilters() {
    setStatus(DEFAULT_SESSION_FILTERS.status)
    setCoachId(DEFAULT_SESSION_FILTERS.coachId)
  }

  const addButton = (
    <Button onClick={() => setScheduling(true)}>
      <Plus className="size-5" aria-hidden />
      {t('sessions:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:sessions')}
        description={isAdmin ? t('sessions:adminDescription') : t('sessions:coachDescription')}
        actions={addButton}
      />

      <Card className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={t('sessions:filters.status.label')}>
          {(c) => (
            <Select
              {...c}
              value={status}
              onChange={(event) => setStatus(event.target.value as SessionFilters['status'])}
            >
              {SESSION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`sessions:filters.status.${value}`)}
                </option>
              ))}
              <option value="all">{t('sessions:filters.status.all')}</option>
            </Select>
          )}
        </Field>
        {isAdmin && (
          <Field label={t('sessions:filters.coach.label')}>
            {(c) => (
              <Select {...c} value={coachId} onChange={(event) => setCoachId(event.target.value)}>
                <option value="">{t('sessions:filters.coach.all')}</option>
                {coaches.data?.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {filtered && (
          <div className="sm:col-span-2">
            <Button variant="ghost" onClick={clearFilters}>
              {t('sessions:filters.clear')}
            </Button>
          </div>
        )}
      </Card>

      {isError ? (
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('sessions:loadError.title')}
            description={t('sessions:loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      ) : isPending ? (
        <div aria-busy className="space-y-3">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchX}
              title={t('sessions:noResults.title')}
              description={t('sessions:noResults.description')}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {t('sessions:filters.clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={t('sessions:empty.title')}
              description={t('sessions:empty.description')}
              action={addButton}
            />
          )}
        </Card>
      ) : (
        <>
          <div aria-label={t('sessions:list.agenda')} role="region" className="space-y-5">
            {groupByDate(rows).map((group) => (
              <section key={group.date} aria-labelledby={`day-${group.date}`}>
                <h2
                  id={`day-${group.date}`}
                  className="mb-2 flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-ink"
                >
                  {dayHeading(group.date, language, {
                    today: t('sessions:day.today'),
                    tomorrow: t('sessions:day.tomorrow'),
                  })}
                  <span className="text-[13px] font-medium text-ink-muted">
                    <bdi dir="ltr">{formatDate(group.date)}</bdi>
                  </span>
                </h2>
                <ul className="space-y-2.5">
                  {group.sessions.map((session) => (
                    <SessionCard key={session.id} session={session} showCoach={isAdmin} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-[15px] text-ink-muted">
              {t('sessions:list.showing', { shown: rows.length, total })}
            </p>
            {hasNextPage && (
              <Button
                variant="secondary"
                onClick={() => void fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t('sessions:list.showMore')}
              </Button>
            )}
          </div>
        </>
      )}

      {scheduling && <SessionFormDialog onClose={() => setScheduling(false)} />}
    </>
  )
}
