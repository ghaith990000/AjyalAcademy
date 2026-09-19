import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  Percent,
  Receipt,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import { Navigate, type RouteObject } from 'react-router-dom'
import HomePage from '@/features/home/HomePage'
import LoginPage from '@/features/auth/pages/LoginPage'
import { AdminShell } from './layouts/AdminShell'
import { AuthLayout } from './layouts/AuthLayout'
import { CoachShell } from './layouts/CoachShell'
import NotFoundPage from './NotFoundPage'
import PlaceholderPage from './PlaceholderPage'

/** Phase 1: role areas are open (no auth yet). Phase 2 wraps them in role guards. */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/admin',
    element: <AdminShell />,
    children: [
      { index: true, element: <HomePage role="admin" /> },
      { path: 'players', element: <PlaceholderPage title="players" phase={3} icon={Users} /> },
      {
        path: 'subscriptions',
        element: <PlaceholderPage title="subscriptions" phase={4} icon={CreditCard} />,
      },
      {
        path: 'sessions',
        element: <PlaceholderPage title="sessions" phase={5} icon={CalendarDays} />,
      },
      { path: 'coaches', element: <PlaceholderPage title="coaches" phase={2} icon={UserCog} /> },
      {
        path: 'discounts',
        element: <PlaceholderPage title="discounts" phase={4} icon={Percent} />,
      },
      { path: 'expenses', element: <PlaceholderPage title="expenses" phase={6} icon={Receipt} /> },
      {
        path: 'reports',
        element: <PlaceholderPage title="reports" phase={6} icon={ChartColumn} />,
      },
      { path: 'settings', element: <PlaceholderPage title="settings" phase={4} icon={Settings} /> },
    ],
  },
  {
    path: '/coach',
    element: <CoachShell />,
    children: [
      { index: true, element: <HomePage role="coach" /> },
      { path: 'players', element: <PlaceholderPage title="myPlayers" phase={3} icon={Users} /> },
      {
        path: 'sessions',
        element: <PlaceholderPage title="sessions" phase={5} icon={CalendarDays} />,
      },
      {
        path: 'subscriptions',
        element: <PlaceholderPage title="subscriptions" phase={4} icon={CreditCard} />,
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
