import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Money } from '@/components/ui/Money'
import { Select } from '@/components/ui/Select'
import { computePricing, type PayMode } from '../draft'
import type { PaymentMethod } from '../api'
import type { StepProps } from './types'

const MODES: PayMode[] = ['full', 'partial', 'unpaid']
const METHODS: PaymentMethod[] = ['cash', 'benefit', 'bank_transfer', 'other']

export function PaymentStep({ draft, onChange, ctx, error }: StepProps) {
  const { t } = useTranslation('subscriptions')
  const total = computePricing(draft, ctx)?.totalFils ?? 0

  if (total === 0) {
    return <p className="text-ink-muted">{t('wizard.payment.zero')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-bold">
        {t('wizard.total')}: <Money fils={total} />
      </p>
      <fieldset className="space-y-1">
        <legend className="sr-only">{t('wizard.payment.heading')}</legend>
        {MODES.map((mode) => (
          <label
            key={mode}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1"
          >
            <input
              type="radio"
              name="pay-mode"
              value={mode}
              checked={draft.payMode === mode}
              onChange={() => onChange({ ...draft, payMode: mode })}
              className="size-5 accent-brand-blue"
            />
            <span className="font-medium">{t(`wizard.payment.${mode}`)}</span>
          </label>
        ))}
      </fieldset>

      {draft.payMode === 'partial' && (
        <Field
          label={t('wizard.payment.amount')}
          required
          error={error === 'amount_invalid' ? t('error.amount_invalid') : undefined}
        >
          {(c) => (
            <Input
              {...c}
              value={draft.payAmount}
              onChange={(event) => onChange({ ...draft, payAmount: event.target.value })}
              inputMode="decimal"
              ltr
            />
          )}
        </Field>
      )}

      {draft.payMode !== 'unpaid' && (
        <Field label={t('wizard.payment.method')}>
          {(c) => (
            <Select
              {...c}
              value={draft.method}
              onChange={(event) =>
                onChange({ ...draft, method: event.target.value as PaymentMethod })
              }
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`methods.${method}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </div>
  )
}
