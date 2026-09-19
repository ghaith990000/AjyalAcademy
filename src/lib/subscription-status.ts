import { differenceInCalendarDays, parseISO } from 'date-fns'

export type SubscriptionStatus = 'upcoming' | 'active' | 'expiring_soon' | 'expired' | 'cancelled'

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'expiring_soon',
  'upcoming',
  'expired',
  'cancelled',
]

/**
 * Status from the dates (docs/05-business-rules.md). `today` is a "yyyy-MM-dd" string. The database
 * view `subscription_overview` computes the same thing; a pgTAP test pins both to the same table.
 * `expiring_soon` = active and at most `expiringSoonDays` days left (the last day counts as 0 days).
 */
export function subscriptionStatus(
  subscription: { start_date: string; end_date: string; cancelled_at: string | null },
  today: string,
  expiringSoonDays: number,
): SubscriptionStatus {
  if (subscription.cancelled_at) return 'cancelled'
  if (today < subscription.start_date) return 'upcoming'
  if (today > subscription.end_date) return 'expired'
  const daysLeft = differenceInCalendarDays(parseISO(subscription.end_date), parseISO(today))
  return daysLeft <= expiringSoonDays ? 'expiring_soon' : 'active'
}
