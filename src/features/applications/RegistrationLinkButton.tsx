import { Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'

/** Copies the public registration address, so the admin can paste it into a WhatsApp group or a message. */
export function RegistrationLinkButton({ variant = 'secondary' }: Pick<ButtonProps, 'variant'>) {
  const { t } = useTranslation('applications')
  const toast = useToast()

  async function copy() {
    // The address parents open to register a child.
    const url = `${window.location.origin}/register`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: t('link.copied'), tone: 'success' })
    } catch {
      // No clipboard access (an insecure page, a locked-down browser): show the address to copy by hand.
      toast({ title: t('link.copyFailed'), description: url, tone: 'info' })
    }
  }

  return (
    <Button variant={variant} onClick={() => void copy()}>
      <Link2 className="size-4" aria-hidden />
      {t('link.copy')}
    </Button>
  )
}
