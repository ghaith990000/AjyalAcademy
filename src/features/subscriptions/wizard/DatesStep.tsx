import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { LocationField } from '@/features/locations/LocationField'
import { effectiveLocationId, withEnd, withLocation, withStart } from '../draft'
import type { StepProps } from './types'

export function DatesStep({ draft, onChange, ctx, error }: StepProps) {
  const { t } = useTranslation('subscriptions')
  const startError = error === 'start_invalid' ? t('error.start_invalid') : undefined
  const endError =
    error === 'end_invalid'
      ? t('error.end_invalid')
      : error === 'end_before_start'
        ? t('error.end_before_start')
        : undefined
  return (
    <div className="space-y-4">
      <LocationField
        required
        label={t('wizard.dates.location')}
        select={{
          value: effectiveLocationId(draft, ctx),
          onChange: (event) => onChange(withLocation(draft, event.target.value)),
        }}
        currentId={effectiveLocationId(draft, ctx)}
        error={error === 'location_required' ? t('error.location_required') : undefined}
      />
      <p className="text-ink-muted">{t('wizard.dates.hint')}</p>
      <Field label={t('wizard.dates.start')} required error={startError}>
        {(c) => (
          <Input
            {...c}
            type="date"
            value={draft.start}
            onChange={(event) => onChange(withStart(draft, event.target.value))}
            ltr
          />
        )}
      </Field>
      <Field label={t('wizard.dates.end')} required error={endError}>
        {(c) => (
          <Input
            {...c}
            type="date"
            value={draft.end}
            min={draft.start}
            onChange={(event) => onChange(withEnd(draft, event.target.value))}
            ltr
          />
        )}
      </Field>
    </div>
  )
}
