import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { formatDiscountValue } from '@/lib/discounts'
import { useLanguage } from '@/lib/useLanguage'
import { checkDiscount, type DiscountMode } from '../draft'
import type { StepProps } from './types'

const MODES: DiscountMode[] = ['none', 'code', 'manual']

export function DiscountStep({ draft, onChange, ctx, error }: StepProps) {
  const { t } = useTranslation('subscriptions')
  const { language } = useLanguage()
  const check = checkDiscount(draft, ctx)
  const errorText = error ? t(`error.${error as 'code_required'}`) : undefined
  // While typing, show the code's outcome right away (but stay quiet about an empty field).
  const codeApplied =
    draft.discountMode === 'code' && check.kind === 'ok' && check.code
      ? t('wizard.discount.codeApplied', {
          name: check.code.name,
          value: formatDiscountValue(check.code.type, check.code.value, language),
        })
      : undefined
  const codeProblem =
    draft.discountMode === 'code' && draft.code.trim() !== '' && check.kind === 'error'
      ? t(`error.${check.error}`)
      : undefined

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="sr-only">{t('wizard.discount.heading')}</legend>
        {MODES.map((mode) => (
          <label
            key={mode}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1"
          >
            <input
              type="radio"
              name="discount-mode"
              value={mode}
              checked={draft.discountMode === mode}
              onChange={() => onChange({ ...draft, discountMode: mode })}
              className="size-5 accent-brand-blue"
            />
            <span className="font-medium">{t(`wizard.discount.${mode}`)}</span>
          </label>
        ))}
      </fieldset>

      {draft.discountMode === 'code' && (
        <Field
          label={t('wizard.discount.codeLabel')}
          required
          hint={codeApplied}
          error={codeProblem ?? errorText}
        >
          {(c) => (
            <Input
              {...c}
              value={draft.code}
              onChange={(event) => onChange({ ...draft, code: event.target.value })}
              placeholder={t('wizard.discount.codePlaceholder')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              ltr
            />
          )}
        </Field>
      )}

      {draft.discountMode === 'manual' && (
        <div className="space-y-4">
          <Field label={t('wizard.discount.manualType')}>
            {(c) => (
              <Select
                {...c}
                value={draft.manualType}
                onChange={(event) =>
                  onChange({ ...draft, manualType: event.target.value as 'percent' | 'fixed' })
                }
              >
                <option value="percent">{t('wizard.discount.percent')}</option>
                <option value="fixed">{t('wizard.discount.fixed')}</option>
              </Select>
            )}
          </Field>
          <Field
            label={
              draft.manualType === 'percent'
                ? t('wizard.discount.percentValue')
                : t('wizard.discount.fixedValue')
            }
            required
            error={error === 'value_invalid' ? errorText : undefined}
          >
            {(c) => (
              <Input
                {...c}
                value={draft.manualValue}
                onChange={(event) => onChange({ ...draft, manualValue: event.target.value })}
                inputMode="decimal"
                ltr
              />
            )}
          </Field>
          <Field
            label={t('wizard.discount.reason')}
            hint={t('wizard.discount.reasonHint')}
            required
            error={error === 'reason_required' ? errorText : undefined}
          >
            {(c) => (
              <Textarea
                {...c}
                value={draft.manualReason}
                onChange={(event) => onChange({ ...draft, manualReason: event.target.value })}
                rows={2}
              />
            )}
          </Field>
        </div>
      )}
    </div>
  )
}
