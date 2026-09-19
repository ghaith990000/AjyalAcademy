import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { OfflineBanner } from '../pwa/OfflineBanner'

/** Login frame: navy hero (logo, name, tagline) over a light sheet on phones; split screen from `md`. */
export function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-2">
      <div className="md:col-span-2">
        <OfflineBanner />
      </div>
      <div className="pt-safe relative flex flex-col items-center justify-center overflow-hidden bg-linear-to-br from-brand-navy via-brand-navy to-brand-blue px-6 pb-14 text-center text-white md:min-h-dvh md:pb-0">
        <div aria-hidden className="pitch-lines absolute inset-0" />
        {/* z-10: the logo block after it is positioned too, and would otherwise sit on top and swallow the taps */}
        <div className="absolute end-4 top-4 z-10 md:end-6 md:top-6">
          <LanguageToggle tone="dark" />
        </div>
        <div className="relative flex flex-col items-center gap-4 pb-6 pt-16 md:py-0">
          <BrandLogo size="lg" />
          <p className="text-3xl font-extrabold">{t('app.name')}</p>
          <p className="max-w-xs text-white/80">{t('app.tagline')}</p>
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-brand-pink md:hidden" />
      </div>
      <main
        id="main"
        className="-mt-6 rounded-t-3xl bg-page px-4 pb-10 pt-8 md:mt-0 md:flex md:items-center md:justify-center md:rounded-none md:px-10"
      >
        <div className="mx-auto w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
