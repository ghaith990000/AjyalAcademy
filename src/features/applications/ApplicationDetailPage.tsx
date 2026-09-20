import {
  Check,
  ChevronLeft,
  CloudOff,
  MessageCircle,
  Phone,
  TriangleAlert,
  UserRoundX,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ageInYears, formatDate, formatTime } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { cn } from '@/lib/utils'
import { AcceptApplicationDialog } from './AcceptApplicationDialog'
import { ApplicationStatusBadge } from './ApplicationStatusBadge'
import { useApplication } from './hooks'
import { RejectApplicationDialog } from './RejectApplicationDialog'
import { decisionLink, decisionMessage } from './whatsapp'

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{children}</dd>
    </div>
  )
}

/** One request in full, with the decision buttons — and, once decided, the ready-made WhatsApp message. */
export default function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['applications', 'players', 'common'])
  const { language } = useLanguage()
  const { data: application, isPending, isError, refetch } = useApplication(id)
  const [dialog, setDialog] = useState<'accept' | 'reject' | null>(null)

  const back = (
    <Link
      to="/admin/applications"
      className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-control pe-3 font-semibold text-brand-blue hover:underline"
    >
      <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
      {t('applications:detail.back')}
    </Link>
  )

  if (isPending) {
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
  if (isError) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('applications:detail.loadError.title')}
            description={t('applications:detail.loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      </>
    )
  }
  if (!application) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={UserRoundX}
            title={t('applications:detail.notFound.title')}
            description={t('applications:detail.notFound.description')}
          />
        </Card>
      </>
    )
  }

  const notProvided = (
    <span className="font-normal text-ink-muted">{t('players:detail.notProvided')}</span>
  )
  const pending = application.status === 'pending'
  const whatsapp = decisionLink(application)
  const when = new Date(application.created_at)
  const decidedAt = application.decided_at ? new Date(application.decided_at) : null

  return (
    <>
      {back}

      <div className="space-y-4">
        <Card className="flex items-center gap-4">
          <Avatar name={application.full_name} size="lg" />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-extrabold text-ink">
              <bdi>{application.full_name}</bdi>
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <ApplicationStatusBadge status={application.status} />
              <Badge tone="info">
                {t('players:age', { age: ageInYears(application.date_of_birth) })}
              </Badge>
              {application.has_disease && (
                <Badge tone="danger">{t('players:medical.condition')}</Badge>
              )}
            </div>
          </div>
        </Card>

        {pending &&
          (application.existing_player_id !== null || application.same_cpr_pending > 0) && (
            <Card className="space-y-2 border-warning/40 bg-warning-50">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <CardTitle>{t('applications:warning.title')}</CardTitle>
                  {application.existing_player_id !== null && (
                    <div>
                      <p>{t('applications:warning.existingPlayer')}</p>
                      <Link
                        to={`/admin/players/${application.existing_player_id}`}
                        className="inline-flex min-h-11 items-center font-bold underline"
                      >
                        <bdi>{application.existing_player_name}</bdi>
                      </Link>
                    </div>
                  )}
                  {application.same_cpr_pending > 0 && (
                    <p>{t('applications:warning.samePending')}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

        {pending && (
          <Card className="space-y-3">
            <CardTitle>{t('applications:detail.decide')}</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => setDialog('accept')} className="sm:flex-1">
                <Check className="size-5" aria-hidden />
                {t('applications:detail.accept')}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setDialog('reject')}
                className="sm:flex-1"
              >
                <X className="size-5" aria-hidden />
                {t('applications:detail.reject')}
              </Button>
            </div>
          </Card>
        )}

        {!pending && (
          <Card className="space-y-3">
            <CardTitle>
              {application.status === 'accepted'
                ? t('applications:decision.accepted')
                : t('applications:decision.rejected')}
            </CardTitle>
            <p className="text-[15px] text-ink-muted">
              {t('applications:decision.by', {
                name: application.decided_by_name ?? t('applications:decision.someone'),
                date: decidedAt ? formatDate(decidedAt) : '—',
              })}
            </p>
            {application.decision_note && (
              <p dir="auto" className="whitespace-pre-line break-words rounded-control bg-page p-3">
                <span className="block text-[13px] text-ink-muted">
                  {t('applications:decision.note')}
                </span>
                {application.decision_note}
              </p>
            )}
            {application.status === 'accepted' && application.player_id && (
              <Button asChild variant="secondary">
                <Link to={`/admin/players/${application.player_id}`}>
                  {t('applications:decision.openPlayer')}
                </Link>
              </Button>
            )}

            <div className="space-y-2 border-t border-line pt-3">
              <h3 className="font-bold text-ink">{t('applications:whatsapp.title')}</h3>
              <p className="text-[15px] text-ink-muted">{t('applications:whatsapp.hint')}</p>
              <p
                dir={application.language === 'ar' ? 'rtl' : 'ltr'}
                lang={application.language}
                className="whitespace-pre-line break-words rounded-control bg-page p-3 text-[15px]"
              >
                {decisionMessage(application)}
              </p>
              {whatsapp ? (
                <Button asChild size="lg" fullWidth>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" aria-hidden />
                    {t('applications:whatsapp.button', { name: application.guardian_name })}
                  </a>
                </Button>
              ) : (
                <p role="status" className="text-[15px] font-medium text-warning">
                  {t('applications:whatsapp.badNumber')}
                </p>
              )}
            </div>
          </Card>
        )}

        <Card>
          <CardTitle>{t('applications:detail.child')}</CardTitle>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoRow label={t('players:detail.cpr')}>
              <bdi dir="ltr">{application.cpr}</bdi>
            </InfoRow>
            <InfoRow label={t('players:detail.dob')}>
              <bdi dir="ltr">{formatDate(application.date_of_birth)}</bdi>
            </InfoRow>
            <InfoRow label={t('players:detail.school')}>
              {application.school ?? notProvided}
            </InfoRow>
            <InfoRow label={t('players:detail.address')}>
              {application.address ?? notProvided}
            </InfoRow>
          </dl>
          <div
            className={cn(
              'mt-4 rounded-control p-3',
              application.has_disease ? 'bg-danger-50 text-danger' : 'bg-page text-ink-muted',
            )}
          >
            <p className="text-[13px] font-semibold">{t('players:detail.medicalTitle')}</p>
            <p dir="auto" className="whitespace-pre-line break-words font-medium">
              {application.has_disease
                ? application.disease_description
                : t('players:detail.medicalNone')}
            </p>
          </div>
        </Card>

        <Card>
          <CardTitle>{t('applications:detail.parent')}</CardTitle>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoRow label={t('applications:detail.parentName')}>
              <bdi>{application.guardian_name}</bdi>
            </InfoRow>
            <InfoRow label={t('applications:detail.phone')}>
              <a
                href={`tel:${application.phone}`}
                className="inline-flex min-h-11 items-center gap-2 text-brand-blue underline"
              >
                <Phone className="size-4" aria-hidden />
                <bdi dir="ltr">{application.phone}</bdi>
              </a>
            </InfoRow>
            <InfoRow label={t('applications:detail.language')}>
              {t(`applications:languages.${application.language}`)}
            </InfoRow>
            <InfoRow label={t('applications:detail.location')}>
              {application.location_name ? <bdi>{application.location_name}</bdi> : notProvided}
            </InfoRow>
            <InfoRow label={t('applications:detail.sent')}>
              <bdi dir="ltr">
                {formatDate(when)} {formatTime(when, language)}
              </bdi>
            </InfoRow>
          </dl>
        </Card>
      </div>

      {dialog === 'accept' && (
        <AcceptApplicationDialog application={application} onClose={() => setDialog(null)} />
      )}
      {dialog === 'reject' && (
        <RejectApplicationDialog application={application} onClose={() => setDialog(null)} />
      )}
    </>
  )
}
