import { ChartColumn, Receipt } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'
import AttendancePage from '@/features/attendance/AttendancePage'
import { RedirectIfSignedIn, RequireRole, RootRedirect } from '@/features/auth/guards'
import LoginPage from '@/features/auth/pages/LoginPage'
import CoachesPage from '@/features/coaches/CoachesPage'
import DiscountsPage from '@/features/discounts/DiscountsPage'
import PlayerDetailPage from '@/features/players/PlayerDetailPage'
import PlayersPage from '@/features/players/PlayersPage'
import SessionDetailPage from '@/features/sessions/SessionDetailPage'
import SessionsPage from '@/features/sessions/SessionsPage'
import SettingsPage from '@/features/settings/SettingsPage'
import NewSubscriptionPage from '@/features/subscriptions/NewSubscriptionPage'
import SubscriptionDetailPage from '@/features/subscriptions/SubscriptionDetailPage'
import SubscriptionsPage from '@/features/subscriptions/SubscriptionsPage'
import HomePage from '@/features/home/HomePage'
import { AdminShell } from './layouts/AdminShell'
import { AuthLayout } from './layouts/AuthLayout'
import { CoachShell } from './layouts/CoachShell'
import NotFoundPage from './NotFoundPage'
import PlaceholderPage from './PlaceholderPage'

/** `/admin/*` needs an active admin, `/coach/*` an active coach (see features/auth/guards). */
export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  {
    path: '/login',
    element: <RedirectIfSignedIn />,
    children: [{ element: <AuthLayout />, children: [{ index: true, element: <LoginPage /> }] }],
  },
  {
    element: <RequireRole role="admin" />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          { index: true, element: <HomePage role="admin" /> },
          { path: 'players', element: <PlayersPage /> },
          { path: 'players/:id', element: <PlayerDetailPage /> },
          { path: 'subscriptions', element: <SubscriptionsPage /> },
          { path: 'subscriptions/new', element: <NewSubscriptionPage /> },
          { path: 'subscriptions/:id', element: <SubscriptionDetailPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'sessions/:id', element: <SessionDetailPage /> },
          { path: 'sessions/:id/attendance', element: <AttendancePage /> },
          { path: 'coaches', element: <CoachesPage /> },
          { path: 'discounts', element: <DiscountsPage /> },
          {
            path: 'expenses',
            element: <PlaceholderPage title="expenses" phase={6} icon={Receipt} />,
          },
          {
            path: 'reports',
            element: <PlaceholderPage title="reports" phase={6} icon={ChartColumn} />,
          },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="coach" />,
    children: [
      {
        path: '/coach',
        element: <CoachShell />,
        children: [
          { index: true, element: <HomePage role="coach" /> },
          { path: 'players', element: <PlayersPage /> },
          { path: 'players/:id', element: <PlayerDetailPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'sessions/:id', element: <SessionDetailPage /> },
          { path: 'sessions/:id/attendance', element: <AttendancePage /> },
          { path: 'subscriptions', element: <SubscriptionsPage /> },
          { path: 'subscriptions/new', element: <NewSubscriptionPage /> },
          { path: 'subscriptions/:id', element: <SubscriptionDetailPage /> },
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
