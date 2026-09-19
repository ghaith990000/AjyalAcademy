import {
  CalendarCheck,
  ChevronLeft,
  CloudOff,
  CreditCard,
  HeartPulse,
  Pencil,
  TriangleAlert,
  Trash2,
  UserRoundX,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/features/auth/useAuth'
import { useCoaches } from '@/features/coaches/hooks'
import { ageInYears, formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { PlayerRow } from './api'
import { useAssignPlayers, usePlayer, usePlayersBasePath } from './hooks'
import { PlayerFormDialog } from './PlayerFormDialog'
import { RemovePlayerDialog } from './RemovePlayerDialog'

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{children}</dd>
    </div>
  )
}

function CoachAssignment({ player }: { player: PlayerRow }) {
  const { t } = useTranslation(['players'])
  const toast = useToast()
  const coaches = useCoaches()
  const assign = useAssignPlayers()
  const current = player.coach_id ?? ''
  const [choice, setChoice] = useState(current)

  async function save() {
    try {
      await assign.mutateAsync({ ids: [player.id], coachId: choice === '' ? null : choice })
      toast({ title: t('players:toast.assigned'), tone: 'success' })
    } catch {
      // the global mutation error handler already showed a translated toast
    }
  }

  // Keep the current coach selectable even if they were deactivated since.
  const options = (coaches.data ?? []).filter((coach) => coach.active || coach.id === current)

  return (
    <Card>
      <CardTitle>{t('players:assign.single.title')}</CardTitle>
      <p className="mt-1 text-[15px] text-ink-muted">{t('players:assign.single.hint')}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={t('players:assign.coach.label')} className="flex-1">
          {(c) => (
            <Select {...c} value={choice} onChange={(event) => setChoice(event.target.value)}>
              <option value="">{t('players:unassigned')}</option>
              {options.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button
          onClick={() => void save()}
          loading={assign.isPending}
          disabled={choice === current}
        >
          {t('players:assign.single.save')}
        </Button>
      </div>
    </Card>
  )
}

export default function PlayerDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['players', 'common'])
  const navigate = useNavigate()
  const base = usePlayersBasePath()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { data: player, isPending, isError, refetch } = usePlayer(id)
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)

  const back = (
    <Link
      to={base}
      className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-control pe-3 font-semibold text-brand-blue hover:underline"
    >
      <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
      {t('players:detail.back')}
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
            title={t('players:detail.loadError.title')}
            description={t('players:detail.loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      </>
    )
  }
  if (!player) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={UserRoundX}
            title={t('players:detail.notFound.title')}
            description={t('players:detail.notFound.description')}
          />
        </Card>
      </>
    )
  }

  const notProvided = (
    <span className="font-normal text-ink-muted">{t('players:detail.notProvided')}</span>
  )

  return (
    <>
      {back}

      <div className="space-y-4">
        <Card className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar name={player.full_name} size="lg" />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold text-ink">{player.full_name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="info">
                  {t('players:age', { age: ageInYears(player.date_of_birth) })}
                </Badge>
                {player.has_disease && (
                  <Badge tone="danger">{t('players:medical.condition')}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              {t('players:detail.edit')}
            </Button>
            <Button variant="danger" onClick={() => setRemoving(true)}>
              <Trash2 className="size-4" aria-hidden />
              {t('players:detail.remove')}
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>{t('players:detail.info')}</CardTitle>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoRow label={t('players:detail.cpr')}>
              <bdi dir="ltr">{player.cpr}</bdi>
            </InfoRow>
            <InfoRow label={t('players:detail.dob')}>
              <bdi dir="ltr">{formatDate(player.date_of_birth)}</bdi>
            </InfoRow>
            <InfoRow label={t('players:detail.phone')}>
              <a
                href={`tel:${player.phone.replace(/\s+/g, '')}`}
                className="text-brand-blue underline"
              >
                <bdi dir="ltr">{player.phone}</bdi>
              </a>
            </InfoRow>
            <InfoRow label={t('players:detail.school')}>{player.school ?? notProvided}</InfoRow>
            <InfoRow label={t('players:detail.address')}>{player.address ?? notProvided}</InfoRow>
            {isAdmin && (
              <InfoRow label={t('players:detail.coach')}>
                {player.coach?.full_name ?? (
                  <span className="font-normal text-ink-muted">{t('players:unassigned')}</span>
                )}
              </InfoRow>
            )}
          </dl>
        </Card>

        <Card className={cn(player.has_disease && 'border-danger/40 bg-danger-50')}>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-control',
                player.has_disease ? 'bg-danger text-white' : 'bg-success-50 text-success',
              )}
            >
              {player.has_disease ? (
                <TriangleAlert className="size-5" aria-hidden />
              ) : (
                <HeartPulse className="size-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <CardTitle className={cn(player.has_disease && 'text-danger')}>
                {player.has_disease
                  ? t('players:detail.medicalAlert')
                  : t('players:detail.medicalTitle')}
              </CardTitle>
              <p dir="auto" className="mt-1 whitespace-pre-line break-words">
                {player.has_disease ? player.disease_description : t('players:detail.medicalNone')}
              </p>
            </div>
          </div>
        </Card>

        {isAdmin && <CoachAssignment key={player.coach_id ?? 'none'} player={player} />}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-brand-blue" aria-hidden />
              <CardTitle>{t('players:detail.subscriptions.title')}</CardTitle>
            </div>
            <p className="mt-2 text-ink-muted">{t('players:detail.subscriptions.soon')}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-brand-blue" aria-hidden />
              <CardTitle>{t('players:detail.attendance.title')}</CardTitle>
            </div>
            <p className="mt-2 text-ink-muted">{t('players:detail.attendance.soon')}</p>
          </Card>
        </div>
      </div>

      {editing && <PlayerFormDialog player={player} onClose={() => setEditing(false)} />}
      {removing && (
        <RemovePlayerDialog
          player={player}
          onClose={() => setRemoving(false)}
          onRemoved={() => navigate(base, { replace: true })}
        />
      )}
    </>
  )
}
