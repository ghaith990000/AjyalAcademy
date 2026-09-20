import { usePendingApplicationCount } from '@/features/applications/hooks'
import type { NavItem } from './nav'

/** What is waiting for the person, per badge kind (0 when nothing, or when it is not theirs to see). */
export function useNavBadges(
  role: 'admin' | 'coach',
): Record<NonNullable<NavItem['badge']>, number> {
  const applications = usePendingApplicationCount({ enabled: role === 'admin' })
  return { applications: applications.data ?? 0 }
}
