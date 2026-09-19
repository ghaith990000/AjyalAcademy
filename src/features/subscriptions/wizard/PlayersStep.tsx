import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { DEFAULT_FILTERS } from '@/features/players/api'
import { usePlayersList } from '@/features/players/hooks'
import { formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'
import { MAX_PLAYERS, planFor, withPlayerToggled } from '../draft'
import type { StepProps } from './types'

export function PlayersStep({ draft, onChange, ctx, error }: StepProps) {
  const { t } = useTranslation(['subscriptions'])
  const { language } = useLanguage()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text), 300)
    return () => clearTimeout(timer)
  }, [text])

  const { rows, isPending } = usePlayersList({ ...DEFAULT_FILTERS, search })
  const plan = planFor(draft, ctx)
  const full = draft.players.length >= MAX_PLAYERS
  const selectedIds = new Set(draft.players.map((p) => p.id))

  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('subscriptions:wizard.players.hint')}</p>

      {draft.players.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            {t('subscriptions:wizard.players.selected')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {draft.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-1 rounded-full bg-brand-blue-50 ps-3 text-brand-blue"
              >
                <span className="py-1 font-semibold">{player.full_name}</span>
                <IconButton
                  label={t('subscriptions:wizard.players.remove', { name: player.full_name })}
                  icon={<X className="size-4" aria-hidden />}
                  onClick={() => onChange(withPlayerToggled(draft, player))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan && (
        <Card className="flex items-center justify-between gap-3 border-brand-blue/30 bg-brand-blue-50">
          <p className="font-bold text-brand-blue">
            {t('subscriptions:wizard.players.planCard', {
              plan: t(`subscriptions:plan.${plan.code as 'solo' | 'duo' | 'trio' | 'quad'}`),
            })}
          </p>
          <p className="font-semibold">
            {t('subscriptions:wizard.players.planPrice', {
              price: formatBHD(plan.price_fils, language),
            })}
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-[15px] font-medium text-danger">
          {t(`subscriptions:error.${error as 'no_players' | 'plan_unavailable'}`)}
        </p>
      )}

      <Field label={t('subscriptions:wizard.players.search')}>
        {(c) => (
          <div className="relative">
            <Input
              {...c}
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoComplete="off"
              dir="auto"
              className="ps-10"
            />
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-5 text-ink-muted"
              aria-hidden
            />
          </div>
        )}
      </Field>

      {full && (
        <p className="text-[13px] text-ink-muted">{t('subscriptions:wizard.players.maxReached')}</p>
      )}

      {isPending ? (
        <Skeleton className="h-32 w-full rounded-card" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-ink-muted">
          {t('subscriptions:wizard.players.noResults')}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map((player) => {
            const selected = selectedIds.has(player.id)
            const disabled = !selected && full
            return (
              <li key={player.id}>
                <label
                  className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 ${disabled ? 'opacity-50' : ''}`}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled}
                    onCheckedChange={() => onChange(withPlayerToggled(draft, player))}
                    aria-label={player.full_name}
                  />
                  <Avatar name={player.full_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{player.full_name}</span>
                    <span
                      dir="ltr"
                      className="block truncate text-start text-[13px] text-ink-muted"
                    >
                      {player.cpr}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
