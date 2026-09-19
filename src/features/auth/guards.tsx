import { CloudOff, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { homePathFor, type UserRole } from './auth-context'
import { useAuth } from './useAuth'

function AuthLoading() {
  const { t } = useTranslation('auth')
  return (
    <div
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 text-ink-muted"
    >
      <LoaderCircle className="size-8 animate-spin text-brand-blue" aria-hidden />
      <p>{t('loading')}</p>
    </div>
  )
}

function AuthError() {
  const { t } = useTranslation(['auth', 'common', 'nav'])
  const { retry, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        icon={CloudOff}
        title={t('auth:profileError.title')}
        description={t('auth:profileError.description')}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={retry}>{t('common:actions.retry')}</Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              {t('nav:signOut')}
            </Button>
          </div>
        }
      />
    </div>
  )
}

/** `/` — send people where they belong. */
export function RootRedirect() {
  const { status, profile } = useAuth()
  if (status === 'loading') return <AuthLoading />
  if (status === 'error') return <AuthError />
  return <Navigate to={profile ? homePathFor(profile.role) : '/login'} replace />
}

/** `/login` — signed-in users skip the login screen. */
export function RedirectIfSignedIn() {
  const { status, profile } = useAuth()
  if (status === 'loading') return <AuthLoading />
  if (status === 'error') return <AuthError />
  if (profile) return <Navigate to={homePathFor(profile.role)} replace />
  return <Outlet />
}

/** Guards a route subtree: signed-out → /login, wrong role → that role's own home. */
export function RequireRole({ role }: { role: UserRole }) {
  const { status, profile } = useAuth()
  if (status === 'loading') return <AuthLoading />
  if (status === 'error') return <AuthError />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== role) return <Navigate to={homePathFor(profile.role)} replace />
  return <Outlet />
}
