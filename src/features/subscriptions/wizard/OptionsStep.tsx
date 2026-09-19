import { Bus, Shirt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { CheckboxField } from '@/components/ui/Checkbox'
import { formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'
import { tshirtApplies } from '../draft'
import type { StepProps } from './types'

/** Per player: T-shirt (automatic; an admin may change it) and transport. */
export function OptionsStep({ draft, onChange, ctx }: StepProps) {
  const { t } = useTranslation('subscriptions')
  const { language } = useLanguage()
  const tshirtFee = formatBHD(ctx.settings?.tshirt_fee_fils ?? 0, language)
  const transportFee = formatBHD(ctx.settings?.transport_fee_fils ?? 0, language)

  return (
    <div className="space-y-3">
      {draft.players.map((player) => {
        const returning = ctx.returning.has(player.id)
        const tshirt = tshirtApplies(draft, player.id, ctx)
        return (
          <Card key={player.id} className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{player.full_name}</h3>
              <Badge tone={returning ? 'neutral' : 'accent'}>
                {returning ? t('wizard.options.returning') : t('wizard.options.firstTime')}
              </Badge>
            </div>
            <CheckboxField
              label={
                <span className="flex items-center gap-2">
                  <Shirt className="size-4 text-ink-muted" aria-hidden />
                  <bdi>{t('wizard.options.tshirt', { fee: tshirtFee })}</bdi>
                </span>
              }
              hint={ctx.isAdmin ? undefined : t('wizard.options.tshirtAuto')}
              checked={tshirt}
              disabled={!ctx.isAdmin}
              onCheckedChange={(checked) =>
                onChange({ ...draft, tshirt: { ...draft.tshirt, [player.id]: checked === true } })
              }
            />
            <CheckboxField
              label={
                <span className="flex items-center gap-2">
                  <Bus className="size-4 text-ink-muted" aria-hidden />
                  <bdi>{t('wizard.options.transport', { fee: transportFee })}</bdi>
                </span>
              }
              checked={draft.transport[player.id] === true}
              onCheckedChange={(checked) =>
                onChange({
                  ...draft,
                  transport: { ...draft.transport, [player.id]: checked === true },
                })
              }
            />
          </Card>
        )
      })}
    </div>
  )
}
