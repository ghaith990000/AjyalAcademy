import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import type { SubscriptionStatus } from '@/lib/subscription-status'

const TONE = {
  active: 'success',
  expiring_soon: 'warning',
  upcoming: 'info',
  expired: 'neutral',
  cancelled: 'danger',
} as const satisfies Record<
  SubscriptionStatus,
  'success' | 'warning' | 'info' | 'neutral' | 'danger'
>

/** Always text + dot (never colour alone). */
export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useTranslation('subscriptions')
  return <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
}
