import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/useOnline'

/** A strip at the top of the page while the device has no connection — nothing can be saved until it returns. */
export function OfflineBanner() {
  const { t } = useTranslation('pwa')
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="pt-safe flex items-start gap-3 bg-warning-50 px-4 py-2.5 text-ink"
    >
      <WifiOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p className="text-[15px]">
        <span className="font-bold">{t('offline.title')}.</span> {t('offline.description')}
      </p>
    </div>
  )
}
