import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { OfflineBanner } from '../pwa/OfflineBanner'

/** Frame for pages anyone can open without signing in (the parents' registration form): brand bar, then the page. */
export function PublicLayout() {
  const { t } = useTranslation(['common', 'register'])
  return (
    <div className="min-h-dvh bg-page">
      <OfflineBanner />
      <header className="pt-safe bg-brand-navy text-white">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" />
            <span className="truncate text-lg font-bold">{t('common:app.name')}</span>
          </div>
          <LanguageToggle tone="dark" />
        </div>
        <span aria-hidden className="block h-0.5 bg-brand-pink" />
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-center text-[15px] text-ink-muted">
        {t('register:staff')}{' '}
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center font-semibold text-brand-blue"
        >
          {t('register:signIn')}
        </Link>
      </footer>
    </div>
  )
}
