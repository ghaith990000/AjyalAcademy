import { useTranslation } from 'react-i18next'
import { ajyalCodeOf, errorKeyOf } from '@/lib/errors'

/** The `ajyal:<code>` values the expenses guard and `generate_monthly_salaries` raise (`expenses:error.*`). */
const KNOWN_CODES = [
  'future_date',
  'invalid_coach',
  'invalid_period',
  'expense_not_found',
  'invalid_location',
] as const
type KnownCode = (typeof KNOWN_CODES)[number]

const isKnown = (code: string | null): code is KnownCode =>
  code !== null && (KNOWN_CODES as readonly string[]).includes(code)

/**
 * Turns an error from an expense write or the salary run into a translated sentence: business-rule errors get
 * their own message, anything else falls back to the generic categories. Raw database text is never shown.
 */
export function useExpenseError() {
  const { t } = useTranslation(['expenses', 'errors'])
  return (error: unknown): string => {
    const code = ajyalCodeOf(error)
    if (isKnown(code)) return t(`expenses:error.${code}`)
    return t(`errors:${errorKeyOf(error)}`)
  }
}
