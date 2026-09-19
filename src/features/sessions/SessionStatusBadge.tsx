import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import type { SessionStatus } from './schedule'

const TONE = {
  upcoming: 'info',
  done: 'neutral',
  cancelled: 'danger',
} as const satisfies Record<SessionStatus, 'info' | 'neutral' | 'danger'>

/** Always text + dot (never colour alone). */
export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation('sessions')
  return <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
}
