import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { RedirectIfSignedIn, RequireRole, RootRedirect } from '@/features/auth/guards'
import LoginPage from '@/features/auth/pages/LoginPage'
import { AdminShell } from './layouts/AdminShell'
import { AuthLayout } from './layouts/AuthLayout'
import { CoachShell } from './layouts/CoachShell'
import NotFoundPage from './NotFoundPage'
import { RouteErrorPage } from './RouteErrorPage'
import { RouteLoading } from './RouteLoading'

/**
 * A page loaded when it is first visited (its own chunk), so the first screen only downloads what it needs.
 * The router keeps the current page on screen until the next one has arrived.
 */
type Lazy = { lazy: NonNullable<RouteObject['lazy']> }

const page = (load: () => Promise<{ default: ComponentType }>): Lazy => ({
  lazy: async () => ({ Component: (await load()).default }),
})

// A page that takes a `role` prop (the home screen is the same component for both areas).
const home = (role: 'admin' | 'coach'): Lazy => ({
  lazy: async () => {
    const { default: HomePage } = await import('@/features/home/HomePage')
    return { Component: () => <HomePage role={role} /> }
  },
})

const players = page(() => import('@/features/players/PlayersPage'))
const playerDetail = page(() => import('@/features/players/PlayerDetailPage'))
const subscriptions = page(() => import('@/features/subscriptions/SubscriptionsPage'))
const newSubscription = page(() => import('@/features/subscriptions/NewSubscriptionPage'))
const subscriptionDetail = page(() => import('@/features/subscriptions/SubscriptionDetailPage'))
const sessions = page(() => import('@/features/sessions/SessionsPage'))
const sessionDetail = page(() => import('@/features/sessions/SessionDetailPage'))
const attendance = page(() => import('@/features/attendance/AttendancePage'))

/**
 * `/admin/*` needs an active admin, `/coach/*` an active coach (see features/auth/guards). Inside each shell an
 * error in a page shows in the content area, so the navigation stays usable.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect />, errorElement: <RouteErrorPage /> },
  {
    path: '/login',
    element: <RedirectIfSignedIn />,
    errorElement: <RouteErrorPage />,
    children: [{ element: <AuthLayout />, children: [{ index: true, element: <LoginPage /> }] }],
  },
  {
    element: <RequireRole role="admin" />,
    // Pages are loaded on demand; opened directly, one needs something on screen while it loads.
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          {
            errorElement: <RouteErrorPage inline />,
            children: [
              { index: true, ...home('admin') },
              { path: 'players', ...players },
              { path: 'players/:id', ...playerDetail },
              { path: 'subscriptions', ...subscriptions },
              { path: 'subscriptions/new', ...newSubscription },
              { path: 'subscriptions/:id', ...subscriptionDetail },
              { path: 'sessions', ...sessions },
              { path: 'sessions/:id', ...sessionDetail },
              { path: 'sessions/:id/attendance', ...attendance },
              { path: 'coaches', ...page(() => import('@/features/coaches/CoachesPage')) },
              { path: 'locations', ...page(() => import('@/features/locations/LocationsPage')) },
              { path: 'discounts', ...page(() => import('@/features/discounts/DiscountsPage')) },
              { path: 'expenses', ...page(() => import('@/features/expenses/ExpensesPage')) },
              { path: 'reports', ...page(() => import('@/features/reports/ReportsPage')) },
              { path: 'settings', ...page(() => import('@/features/settings/SettingsPage')) },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="coach" />,
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/coach',
        element: <CoachShell />,
        children: [
          {
            errorElement: <RouteErrorPage inline />,
            children: [
              { index: true, ...home('coach') },
              { path: 'players', ...players },
              { path: 'players/:id', ...playerDetail },
              { path: 'sessions', ...sessions },
              { path: 'sessions/:id', ...sessionDetail },
              { path: 'sessions/:id/attendance', ...attendance },
              { path: 'subscriptions', ...subscriptions },
              { path: 'subscriptions/new', ...newSubscription },
              { path: 'subscriptions/:id', ...subscriptionDetail },
            ],
          },
        ],
      },
    ],
  },
  // Development-only component gallery (tree-shaken out of production builds).
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/ui',
          lazy: async () => ({ Component: (await import('@/features/dev/GalleryPage')).default }),
        } satisfies RouteObject,
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
]
