import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Shown while the router loads the page that was asked for on a first visit (a lazy route such as the reports
 * page opened directly); moving between pages inside the app keeps the current page on screen instead.
 */
export function RouteLoading() {
  const { t } = useTranslation('common')
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
