import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useLocations } from './hooks'

type SelectProps = Omit<ComponentProps<'select'>, 'children'>

interface LocationSelectProps extends SelectProps {
  /** Label of the empty choice (default: "Choose a location"). Pass "No location" for an optional field. */
  emptyLabel?: string
  /**
   * The location the record already has: it stays selectable even if it was switched off since, so editing
   * something old never silently drops its location.
   */
  currentId?: string | null
  /** Extra fixed choices after the empty one, e.g. "No location" in a filter. */
  extraOptions?: readonly { value: string; label: string }[]
}

/**
 * A native select of the academy's locations. Switched-off locations are offered only when they are the current
 * value. It re-mounts once the list has arrived so a form's default value is applied to the finished list.
 */
export function LocationSelect({
  emptyLabel,
  currentId,
  extraOptions = [],
  ...props
}: LocationSelectProps) {
  const { t } = useTranslation('locations')
  const { data, isPending } = useLocations()
  const options = (data ?? []).filter((location) => location.active || location.id === currentId)
  return (
    <Select key={isPending ? 'loading' : 'ready'} {...props} disabled={isPending || props.disabled}>
      <option value="">{emptyLabel ?? t('select.placeholder')}</option>
      {extraOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {options.map((location) => (
        <option key={location.id} value={location.id}>
          {location.active ? location.name : t('select.inactiveOption', { name: location.name })}
        </option>
      ))}
    </Select>
  )
}

interface LocationFieldProps {
  select: SelectProps
  label?: ReactNode
  required?: boolean
  error?: ReactNode
  currentId?: string | null
  emptyLabel?: string
  /** Shown under the select (replaced by the "no locations yet" note when one is required and none exists). */
  hint?: ReactNode
}

/** A labelled location select; when a location is required but none exists yet it says what to do about it. */
export function LocationField({
  select,
  label,
  required,
  error,
  currentId,
  emptyLabel,
  hint,
}: LocationFieldProps) {
  const { t } = useTranslation('locations')
  const { data } = useLocations()
  const noneYet = required && data !== undefined && !data.some((location) => location.active)
  return (
    <Field
      label={label ?? t('field.label')}
      required={required}
      error={error}
      hint={noneYet ? t('field.noneYet') : hint}
    >
      {(c) => <LocationSelect {...c} {...select} currentId={currentId} emptyLabel={emptyLabel} />}
    </Field>
  )
}
