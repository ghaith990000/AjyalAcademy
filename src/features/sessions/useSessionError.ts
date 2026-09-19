import { useTranslation } from 'react-i18next'
import { ajyalCodeOf, errorKeyOf } from '@/lib/errors'

/** The `ajyal:<code>` values the sessions guard trigger and `save_attendance` raise (`sessions:error.*`). */
const KNOWN_CODES = [
  'invalid_coach',
  'session_cancelled',
  'session_has_attendance',
  'session_in_future',
  'session_not_found',
  'not_on_roster',
  'invalid_records',
  'forbidden',
] as const
type KnownCode = (typeof KNOWN_CODES)[number]

const isKnown = (code: string | null): code is KnownCode =>
  code !== null && (KNOWN_CODES as readonly string[]).includes(code)

/**
 * Turns an error from a session write or `save_attendance` into a translated sentence: business-rule errors
 * get their own message, anything else falls back to the generic categories. Raw database text is never shown.
 */
export function useSessionError() {
  const { t } = useTranslation(['sessions', 'errors'])
  return (error: unknown): string => {
    const code = ajyalCodeOf(error)
    if (isKnown(code)) return t(`sessions:error.${code}`)
    return t(`errors:${errorKeyOf(error)}`)
  }
}
