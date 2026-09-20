import { CloudOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/features/auth/useAuth'
import { useLocations } from '@/features/locations/hooks'
import { usePlayer } from '@/features/players/hooks'
import type { PlayerRow } from '@/features/players/api'
import { usePlans, useSettings } from '@/features/settings/hooks'
import { todayISO } from '@/lib/dates'
import { ajyalCodeOf } from '@/lib/errors'
import { cn } from '@/lib/utils'
import {
  buildParams,
  computePricing,
  initialDraft,
  STEPS,
  validateStep,
  withPlayerToggled,
  type Draft,
  type DraftContext,
  type Step,
  type StepError,
} from './draft'
import {
  useApplicableDiscounts,
  useCreateSubscription,
  useReturningPlayers,
  useSubscriptionsBasePath,
} from './hooks'
import { useSubscriptionError } from './useSubscriptionError'
import { DatesStep } from './wizard/DatesStep'
import { DiscountStep } from './wizard/DiscountStep'
import { OptionsStep } from './wizard/OptionsStep'
import { PaymentStep } from './wizard/PaymentStep'
import { PlayersStep } from './wizard/PlayersStep'
import { SummaryStep } from './wizard/SummaryStep'

const STEP_VIEWS = {
  players: PlayersStep,
  dates: DatesStep,
  options: OptionsStep,
  discount: DiscountStep,
  summary: SummaryStep,
  payment: PaymentStep,
} as const

function Wizard({ initialPlayer }: { initialPlayer: PlayerRow | null }) {
  const { t } = useTranslation(['subscriptions', 'common', 'errors'])
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const base = useSubscriptionsBasePath()
  const navigate = useNavigate()
  const toast = useToast()
  const errorMessage = useSubscriptionError()

  const plans = usePlans()
  const settings = useSettings()
  const discounts = useApplicableDiscounts()
  const locations = useLocations()
  const create = useCreateSubscription()

  const [draft, setDraft] = useState<Draft>(() => {
    const start = initialDraft(todayISO())
    return initialPlayer ? withPlayerToggled(start, initialPlayer) : start
  })
  const [stepIndex, setStepIndex] = useState(initialPlayer ? 1 : 0)
  const [error, setError] = useState<StepError | null>(null)

  const returning = useReturningPlayers(draft.players.map((p) => p.id))
  const ctx: DraftContext = {
    plans: plans.data ?? [],
    settings: settings.data,
    returning: new Set(returning.data ?? []),
    isAdmin,
    discounts: discounts.data ?? [],
    today: todayISO(),
    locations: locations.data ?? [],
  }

  const step: Step = STEPS[stepIndex]!
  const last = stepIndex === STEPS.length - 1
  const pricing = computePricing(draft, ctx)
  const loadFailed = plans.isError || settings.isError
  // Whether players are "returning" only matters once fees are shown — never hide the player list for it.
  const needsReturning = step !== 'players' && step !== 'dates'
  const waiting =
    plans.isPending ||
    settings.isPending ||
    (needsReturning && draft.players.length > 0 && returning.isPending)
  const StepView = STEP_VIEWS[step]

  function go(index: number) {
    setError(null)
    setStepIndex(index)
  }

  async function next() {
    const problem = validateStep(step, draft, ctx)
    if (problem) {
      setError(problem)
      return
    }
    if (!last) {
      go(stepIndex + 1)
      return
    }
    try {
      const id = await create.mutateAsync(buildParams(draft, ctx))
      toast({ title: t('subscriptions:wizard.toast.created'), tone: 'success' })
      navigate(`${base}/${id}`)
    } catch (failure) {
      const names = Object.fromEntries(draft.players.map((p) => [p.id, p.full_name]))
      toast({ title: t('errors:title'), description: errorMessage(failure, names), tone: 'error' })
      // Send the user to where they can fix it.
      const code = ajyalCodeOf(failure)
      if (code === 'overlap' || code === 'invalid_dates' || code === 'location_required' || code === 'invalid_location') {
        go(STEPS.indexOf('dates'))
      }
      else if (code === 'player_not_found' || code === 'invalid_players') go(0)
    }
  }

  if (loadFailed) {
    return (
      <Card>
        <EmptyState
          icon={CloudOff}
          title={t('subscriptions:loadError.title')}
          description={t('subscriptions:loadError.description')}
          action={
            <Button
              onClick={() => {
                void plans.refetch()
                void settings.refetch()
              }}
            >
              {t('common:actions.retry')}
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <nav aria-label={t('subscriptions:wizard.title')} className="mb-5">
        <p className="mb-2 text-sm font-semibold text-ink-muted">
          {t('subscriptions:wizard.stepOf', { n: stepIndex + 1, total: STEPS.length })} ·{' '}
          <span className="text-ink">{t(`subscriptions:wizard.steps.${step}`)}</span>
        </p>
        <ol className="flex gap-1.5" aria-hidden>
          {STEPS.map((name, index) => (
            <li
              key={name}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                index < stepIndex
                  ? 'bg-brand-blue'
                  : index === stepIndex
                    ? 'bg-brand-pink'
                    : 'bg-line',
              )}
            />
          ))}
        </ol>
      </nav>

      <Card className="mb-4">
        <h2 className="mb-4 text-lg font-bold text-ink">
          {t(`subscriptions:wizard.${step}.heading`)}
        </h2>
        {waiting ? (
          <Skeleton className="h-40 w-full rounded-card" />
        ) : (
          <StepView draft={draft} onChange={setDraft} ctx={ctx} error={error} />
        )}
      </Card>

      <div className="pb-safe sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t border-line bg-surface px-4 py-3 shadow-[0_-4px_16px_-8px_rgb(14_47_107/0.25)] md:bottom-0 md:mx-0 md:rounded-card md:border">
        <div className="min-w-0 flex-1">
          {pricing && stepIndex >= 2 && (
            <>
              <p className="text-[13px] text-ink-muted">{t('subscriptions:wizard.total')}</p>
              <p className="text-lg font-extrabold">
                <Money fils={pricing.totalFils} />
              </p>
            </>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => (stepIndex === 0 ? navigate(base) : go(stepIndex - 1))}
        >
          {t('subscriptions:wizard.back')}
        </Button>
        <Button onClick={() => void next()} loading={create.isPending} disabled={waiting}>
          {last ? t('subscriptions:wizard.create') : t('subscriptions:wizard.next')}
        </Button>
      </div>
    </>
  )
}

/** `/…/subscriptions/new[?player=<id>]` — the player, if given, is pre-selected and the flow starts at "Period". */
export default function NewSubscriptionPage() {
  const { t } = useTranslation('subscriptions')
  const [params] = useSearchParams()
  const playerId = params.get('player')
  const player = usePlayer(playerId ?? '')
  const loadingPlayer = playerId !== null && player.isPending

  return (
    <>
      <PageHeader title={t('wizard.title')} />
      {loadingPlayer ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : (
        // Mounted only once the optional player is known, so the wizard can start from it.
        <Wizard initialPlayer={playerId ? (player.data ?? null) : null} />
      )}
    </>
  )
}
