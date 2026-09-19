import { Ban, CalendarX, ChevronLeft, ClipboardCheck, CloudOff, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { SessionAttendanceCard } from '@/features/attendance/SessionAttendanceCard'
import { useSessionAttendance } from '@/features/attendance/hooks'
import { formatDate, formatLongDate, formatTimeRange } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { CancelSessionDialog } from './CancelSessionDialog'
import { useSession, useSessionsBasePath } from './hooks'
import { canTakeAttendance, sessionStatus } from './schedule'
import { SessionFormDialog } from './SessionFormDialog'
import { SessionStatusBadge } from './SessionStatusBadge'

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{children}</dd>
    </div>
  )
}

export default function SessionDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['sessions', 'common'])
  const { language } = useLanguage()
  const base = useSessionsBasePath()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { data: session, isPending, isError, refetch } = useSession(id)
  const attendance = useSessionAttendance(id)
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const back = (
    <Link
      to={base}
      className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-control pe-3 font-semibold text-brand-blue hover:underline"
    >
      <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
      {t('sessions:detail.back')}
    </Link>
  )

  if (isPending) {
    return (
      <>
        {back}
        <div aria-busy className="space-y-4">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
      </>
    )
  }
  if (isError) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('sessions:detail.loadError.title')}
            description={t('sessions:detail.loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
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
            title={t('sessions:detail.notFound.title')}
            description={t('sessions:detail.notFound.description')}
          />
        </Card>
      </>
    )
  }

  const status = sessionStatus(session)
  const cancelled = status === 'cancelled'
  const notProvided = (
    <span className="font-normal text-ink-muted">{t('sessions:detail.notProvided')}</span>
  )

  return (
    <>
      {back}

      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold text-ink">
                {formatLongDate(session.session_date, language)}
              </h1>
              <p className="mt-1 text-lg font-bold text-ink">
                <bdi>{formatTimeRange(session.start_time, session.end_time, language)}</bdi>
                <span className="ms-2 text-[15px] font-medium text-ink-muted">
                  <bdi dir="ltr">{formatDate(session.session_date)}</bdi>
                </span>
              </p>
            </div>
            <SessionStatusBadge status={status} />
          </div>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {isAdmin && (
              <InfoRow label={t('sessions:detail.coach')}>
                {session.coach?.full_name ?? notProvided}
              </InfoRow>
            )}
            <InfoRow label={t('sessions:detail.location')}>
              {session.location ? <span dir="auto">{session.location}</span> : notProvided}
            </InfoRow>
            <InfoRow label={t('sessions:detail.notes')}>
              {session.notes ? (
                <span dir="auto" className="whitespace-pre-line">
                  {session.notes}
                </span>
              ) : (
                notProvided
              )}
            </InfoRow>
          </dl>

          {cancelled ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-card bg-danger-50 p-3.5 font-medium text-danger"
            >
              <Ban className="mt-0.5 size-5 shrink-0" aria-hidden />
              {t('sessions:detail.cancelledNotice')}
            </p>
          ) : (
            <>
              {!canTakeAttendance(session) && (
                <p className="text-ink-muted">{t('sessions:detail.attendanceOpens')}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {canTakeAttendance(session) && (
                  <Button asChild>
                    <Link to={`${base}/${session.id}/attendance`}>
                      <ClipboardCheck className="size-5" aria-hidden />
                      {attendance.data && attendance.data.length > 0
                        ? t('sessions:detail.editAttendance')
                        : t('sessions:detail.takeAttendance')}
                    </Link>
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden />
                  {t('sessions:detail.edit')}
                </Button>
                <Button variant="danger" onClick={() => setCancelling(true)}>
                  <Ban className="size-4" aria-hidden />
                  {t('sessions:detail.cancel')}
                </Button>
              </div>
            </>
          )}
        </Card>

        <SessionAttendanceCard sessionId={session.id} />
      </div>

      {editing && <SessionFormDialog session={session} onClose={() => setEditing(false)} />}
      {cancelling && (
        <CancelSessionDialog sessionId={session.id} onClose={() => setCancelling(false)} />
      )}
    </>
  )
}
