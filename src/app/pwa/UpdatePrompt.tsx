import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

/** How often a long-open app asks the server whether a newer version exists. */
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Registers the service worker and, when a new version has been downloaded, offers to switch to it. Nothing
 * reloads by itself, so a half-filled form is never lost to an update.
 */
export function UpdatePrompt() {
  const { t } = useTranslation('pwa')
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS)
    },
  })
  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[65] mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-float md:bottom-6"
    >
      <RefreshCw className="size-5 shrink-0 text-brand-blue" aria-hidden />
      <p className="min-w-0 flex-1 font-semibold text-ink">{t('update.message')}</p>
      <Button onClick={() => void updateServiceWorker(true)}>{t('update.action')}</Button>
    </div>
  )
}
