import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import type { ApplicationStatus } from './api'

const TONES = { pending: 'warning', accepted: 'success', rejected: 'danger' } as const

/** A request's state as a pill (always text, never colour alone). */
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useTranslation('applications')
  return <Badge tone={TONES[status]}>{t(`status.${status}`)}</Badge>
}
