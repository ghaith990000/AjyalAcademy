import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import { isIosDevice, isStandalone, rememberDismissed, wasDismissed } from './install'

/** The event Chrome-based browsers fire when the app can be installed (not in the DOM lib types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

/**
 * A dismissible card on phones offering to put the app on the home screen: an Install button where the browser
 * allows it, and the Share-sheet steps on iPhone. Hidden once installed or dismissed.
 */
export function InstallHint() {
  const { t } = useTranslation(['pwa', 'common'])
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => wasDismissed() || isStandalone())
  const ios = isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault() // keep the browser's own mini-bar away; we show ours
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || (!installEvent && !ios)) return null

  function dismiss() {
    rememberDismissed()
    setHidden(true)
  }

  return (
    <Card
      className="relative space-y-2 pe-14 md:hidden"
      aria-label={t('pwa:install.title')}
      role="region"
    >
      <div className="absolute end-1.5 top-1.5">
        <IconButton
          label={t('pwa:install.dismiss')}
          icon={<X className="size-5" aria-hidden />}
          onClick={dismiss}
        />
      </div>
      <p className="font-bold text-ink">{t('pwa:install.title')}</p>
      <p className="text-ink-muted">{t('pwa:install.description')}</p>
      {installEvent ? (
        <Button
          onClick={() => {
            void installEvent.prompt().finally(() => setInstallEvent(null))
          }}
        >
          <Download className="size-5" aria-hidden />
          {t('pwa:install.action')}
        </Button>
      ) : (
        <p className="flex items-start gap-2 text-[15px] text-ink">
          <Share className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
          {t('pwa:install.iosSteps')}
        </p>
      )}
    </Card>
  )
}
