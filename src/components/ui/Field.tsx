import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  'aria-required'?: true
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  /** Already-translated error message. */
  error?: ReactNode
  required?: boolean
  className?: string
  /** Render prop: spread the given props onto the control so label/hint/error are wired for a11y. */
  children: (control: FieldControlProps) => ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const { t } = useTranslation('ui')
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden className="ms-0.5 text-brand-pink">
              *
            </span>
            <span className="sr-only"> ({t('required')})</span>
          </>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-[13px] font-medium text-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
