import { useTranslation } from 'react-i18next'
import { ajyalCodeOf, errorKeyOf } from '@/lib/errors'

/** The `ajyal:<code>` values the decision functions raise (`applications:error.*`). */
const KNOWN_CODES = [
  'already_decided',
  'application_not_found',
  'invalid_coach',
  'invalid_location',
  'invalid_input',
] as const
type KnownCode = (typeof KNOWN_CODES)[number]

const isKnown = (code: string | null): code is KnownCode =>
  code !== null && (KNOWN_CODES as readonly string[]).includes(code)

/** Turns an error from accepting or rejecting a request into a translated sentence (never raw database text). */
export function useApplicationError() {
  const { t } = useTranslation(['applications', 'errors'])
  return (error: unknown): string => {
    const code = ajyalCodeOf(error)
    if (isKnown(code)) return t(`applications:error.${code}`)
    return t(`errors:${errorKeyOf(error)}`)
  }
}
