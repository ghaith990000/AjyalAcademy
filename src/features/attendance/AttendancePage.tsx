import { Ban, CalendarClock, CalendarX, Check, ChevronLeft, CloudOff, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/features/auth/useAuth'
import { useSession, useSessionsBasePath } from '@/features/sessions/hooks'
import { canTakeAttendance, sessionStatus } from '@/features/sessions/schedule'
import { useSessionError } from '@/features/sessions/useSessionError'
import { usePlayersCoveredOn } from '@/features/subscriptions/hooks'
import { formatDate, formatLongDate, formatTimeRange } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { cn } from '@/lib/utils'
import { useRoster, useSaveAttendance, useSessionAttendance } from './hooks'
import { countMarks, flip, hasChanges, initialMarks, markAll, toRecords, type Marks } from './marks'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3 text-center">
      <p className="text-2xl font-extrabold tabular-nums text-ink">{value}</p>
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
    </div>
  )
}

/** The screen a coach uses on the pitch: one big tap per player, live counts, one save. */
export default function AttendancePage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['attendance', 'sessions', 'common', 'errors'])
  const { language } = useLanguage()
  const navigate = useNavigate()
  const toast = useToast()
  const errorMessage = useSessionError()
  const base = useSessionsBasePath()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const sessionQuery = useSession(id)
  const session = sessionQuery.data
  const rosterQuery = useRoster(session?.coach_id)
  const savedQuery = useSessionAttendance(id)
  const save = useSaveAttendance()

  const roster = useMemo(() => {
    const collator = new Intl.Collator(language)
    return [...(rosterQuery.data ?? [])].sort((a, b) => collator.compare(a.full_name, b.full_name))
  }, [rosterQuery.data, language])
  const rosterIds = useMemo(() => roster.map((player) => player.id), [roster])
  const saved = savedQuery.data
  const covered = usePlayersCoveredOn(rosterIds, session?.session_date)

  // What the coach tapped on top of what was saved; everyone else keeps their saved (or "absent") mark.
  const [edits, setEdits] = useState<Marks>({})
  const marks: Marks = { ...initialMarks(rosterIds, saved ?? []), ...edits }
  const counts = countMarks(rosterIds, marks)
  const dirty = hasChanges(rosterIds, marks, saved ?? [])
  const alreadySaved = (saved?.length ?? 0) > 0

  const back = (
    <Link
      to={session ? `${base}/${session.id}` : base}
      className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-control pe-3 font-semibold text-brand-blue hover:underline"
    >
      <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
      {t('attendance:back')}
    </Link>
  )

  const loading =
    sessionQuery.isPending ||
    (session !== null && session !== undefined && (rosterQuery.isPending || savedQuery.isPending))
  const failed = sessionQuery.isError || rosterQuery.isError || savedQuery.isError

  if (failed) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('attendance:loadError.title')}
            description={t('attendance:loadError.description')}
            action={
              <Button
                onClick={() => {
                  void sessionQuery.refetch()
                  void rosterQuery.refetch()
                  void savedQuery.refetch()
                }}
              >
                {t('common:actions.retry')}
              </Button>
            }
          />
        </Card>
      </>
    )
  }
  if (loading) {
    return (
      <>
        {back}
        <div aria-busy className="space-y-3">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      </>
    )
  }
  if (!session) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CalendarX}
            title={t('attendance:notFound.title')}
            description={t('attendance:notFound.description')}
          />
        </Card>
      </>
    )
  }
  if (sessionStatus(session) === 'cancelled') {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={Ban}
            title={t('attendance:cancelled.title')}
            description={t('attendance:cancelled.description')}
          />
        </Card>
      </>
    )
  }

  if (!canTakeAttendance(session)) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CalendarClock}
            title={t('attendance:future.title')}
            description={t('attendance:future.description')}
          />
        </Card>
      </>
    )
  }

  async function onSave() {
    try {
      await save.mutateAsync({ sessionId: id, records: toRecords(rosterIds, marks) })
      toast({ title: t('attendance:saved'), tone: 'success' })
      navigate(`${base}/${id}`)
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <>
      {back}

      <Card className="mb-4">
        <h1 className="text-2xl font-extrabold text-ink">{t('attendance:title')}</h1>
        <p className="mt-1 font-semibold text-ink">
          {formatLongDate(session.session_date, language)}
          <span className="ms-2 font-medium text-ink-muted">
            <bdi dir="ltr">{formatDate(session.session_date)}</bdi>
          </span>
        </p>
        <p className="text-ink-muted">
          <bdi>{formatTimeRange(session.start_time, session.end_time, language)}</bdi>
          {isAdmin && session.coach && <> · {session.coach.full_name}</>}
          {session.location && (
            <>
              {' · '}
              <span dir="auto">{session.location}</span>
            </>
          )}
        </p>
      </Card>

      {roster.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={t('attendance:roster.empty.title')}
            description={t('attendance:roster.empty.description')}
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-ink-muted">{t('attendance:intro')}</p>

          <div role="status" className="mb-3 grid grid-cols-3 gap-2">
            <Stat label={t('attendance:counts.present')} value={counts.present} />
            <Stat label={t('attendance:counts.absent')} value={counts.absent} />
            <Stat label={t('attendance:counts.total')} value={counts.total} />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEdits(markAll(rosterIds, 'present'))}>
              {t('attendance:markAll')}
            </Button>
            <Button variant="ghost" onClick={() => setEdits(markAll(rosterIds, 'absent'))}>
              {t('attendance:clear')}
            </Button>
          </div>

          <ul aria-label={t('attendance:list.caption')} className="space-y-2">
            {roster.map((player) => {
              const present = marks[player.id] === 'present'
              const warn = covered.isSuccess && !covered.data.includes(player.id)
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    aria-pressed={present}
                    onClick={() =>
                      setEdits((current) => ({
                        ...current,
                        [player.id]: flip(marks[player.id] ?? 'absent'),
                      }))
                    }
                    className={cn(
                      'flex min-h-16 w-full items-center gap-3 rounded-card border p-3 text-start transition-colors',
                      present
                        ? 'border-success/50 bg-success-50'
                        : 'border-line bg-surface hover:bg-brand-blue-50/60',
                    )}
                  >
                    <span aria-hidden className="shrink-0">
                      <Avatar name={player.full_name} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold" dir="auto">
                        {player.full_name}
                      </span>
                      {warn && (
                        <Badge tone="warning" className="mt-1">
                          {t('attendance:noSubscription')}
                        </Badge>
                      )}
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-bold',
                        present
                          ? 'bg-success text-white'
                          : 'bg-page text-ink-muted ring-1 ring-line',
                      )}
                    >
                      {present ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <X className="size-4" aria-hidden />
                      )}
                      {present ? t('attendance:state.present') : t('attendance:state.absent')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Sits just above the phone tab bar (4.5rem + safe area, see AppShell) so Save is always in thumb reach. */}
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-h-5 text-[15px] font-semibold text-warning" aria-live="polite">
                {dirty ? t('attendance:unsaved') : ''}
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                loading={save.isPending}
                disabled={alreadySaved && !dirty}
                onClick={() => void onSave()}
              >
                {t('attendance:save')}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
