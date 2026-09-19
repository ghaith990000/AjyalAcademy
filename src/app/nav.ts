import type { ParseKeys } from 'i18next'
import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  House,
  type LucideIcon,
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
}

export interface NavConfig {
  /** Shown in the phone tab bar (max 4 when `more` is non-empty, else max 5) and the sidebar. */
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
    { to: '/admin/coaches', icon: UserCog, label: 'coaches' },
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
