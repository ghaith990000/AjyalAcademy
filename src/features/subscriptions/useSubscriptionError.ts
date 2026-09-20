import { useTranslation } from 'react-i18next'
import { ajyalCodeOf, errorDetailOf, errorKeyOf } from '@/lib/errors'

/** The `ajyal:<code>` values our SQL functions raise that have a message in `subscriptions:error.*`. */
const KNOWN_CODES = [
  'player_not_found',
  'invalid_players',
  'invalid_dates',
  'location_required',
  'invalid_location',
  'plan_unavailable',
  'discount_not_found',
  'discount_inactive',
  'discount_expired',
  'discount_not_started',
  'discount_exhausted',
  'discount_conflict',
  'manual_discount_reason_required',
  'manual_discount_invalid',
  'overpayment',
  'subscription_not_found',
  'subscription_cancelled',
  'already_cancelled',
  'reason_required',
  'invalid_amount',
  'invalid_date',
  'forbidden',
] as const
type KnownCode = (typeof KNOWN_CODES)[number]

const isKnown = (code: string | null): code is KnownCode =>
  code !== null && (KNOWN_CODES as readonly string[]).includes(code)

/**
 * Turns an error from a subscription/payment RPC into a translated sentence. Business-rule errors get their
 * own message; an overlap names the players (ids in the error detail → names via `playerNames`); anything
 * else falls back to the generic categories (network, permission, …). Raw database text is never shown.
 */
export function useSubscriptionError() {
  const { t } = useTranslation(['subscriptions', 'errors'])
  return (error: unknown, playerNames: Readonly<Record<string, string>> = {}): string => {
    const code = ajyalCodeOf(error)
    if (code === 'overlap') {
      const names = (errorDetailOf(error) ?? '')
        .split(',')
        .map((id) => playerNames[id])
        .filter((name): name is string => Boolean(name))
      return names.length > 0
        ? t('subscriptions:error.overlap', { names: names.join(', ') })
        : t('subscriptions:error.overlapUnknown')
    }
    if (isKnown(code)) return t(`subscriptions:error.${code}`)
    return t(`errors:${errorKeyOf(error)}`)
  }
}
