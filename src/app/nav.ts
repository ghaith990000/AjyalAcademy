import type { ParseKeys } from 'i18next'
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CreditCard,
  House,
  type LucideIcon,
  MapPin,
  Percent,
  Receipt,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  /** Key in the `nav` namespace. */
  label: ParseKeys<'nav'>
  /** Shorter label for the phone tab bar, when the full label would not fit. */
  tabLabel?: ParseKeys<'nav'>
  /** Match the path exactly (used for the home item). */
  end?: boolean
  /** A count shown on the entry (what is waiting for the person); the shell reads it, see `useNavBadges`. */
  badge?: 'applications'
}

export interface NavConfig {
  /** Shown in the phone tab bar (at most 4: the fifth tab is always "More") and the sidebar. */
  primary: NavItem[]
  /** Sidebar-only on desktop; collected behind a "More" tab on phones. */
  more: NavItem[]
}

export const adminNav: NavConfig = {
  primary: [
    { to: '/admin', icon: House, label: 'home', end: true },
    { to: '/admin/players', icon: Users, label: 'players' },
    {
      to: '/admin/subscriptions',
      icon: CreditCard,
      label: 'subscriptions',
      tabLabel: 'tab.subscriptions',
    },
    { to: '/admin/sessions', icon: CalendarDays, label: 'sessions' },
  ],
  more: [
    {
      to: '/admin/applications',
      icon: ClipboardList,
      label: 'applications',
      badge: 'applications',
    },
    { to: '/admin/coaches', icon: UserCog, label: 'coaches' },
    { to: '/admin/locations', icon: MapPin, label: 'locations' },
    { to: '/admin/discounts', icon: Percent, label: 'discounts' },
    { to: '/admin/expenses', icon: Receipt, label: 'expenses' },
    { to: '/admin/reports', icon: ChartColumn, label: 'reports' },
    { to: '/admin/settings', icon: Settings, label: 'settings' },
  ],
}

export const coachNav: NavConfig = {
  primary: [
    { to: '/coach', icon: House, label: 'home', end: true },
    { to: '/coach/players', icon: Users, label: 'myPlayers' },
    { to: '/coach/sessions', icon: CalendarDays, label: 'sessions' },
    {
      to: '/coach/subscriptions',
      icon: CreditCard,
      label: 'subscriptions',
      tabLabel: 'tab.subscriptions',
    },
  ],
  more: [],
}
