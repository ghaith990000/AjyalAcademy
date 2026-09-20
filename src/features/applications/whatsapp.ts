import i18n from '@/lib/i18n'
import { whatsappUrl } from '@/lib/whatsapp'
import type { ApplicationRow } from './api'

/**
 * The message the admin sends the parent after a decision — written in the language the parent used on the form
 * (not the admin's screen language). The app sends nothing itself: this opens WhatsApp with the text ready, and
 * the admin can still edit it before pressing send. It names no location: the admin may have placed the player
 * somewhere other than the one the parent asked for, and can add the details in the chat.
 */
export function decisionMessage(application: ApplicationRow): string {
  const values = {
    lng: application.language,
    guardian: application.guardian_name,
    player: application.full_name,
  }
  return application.status === 'accepted'
    ? i18n.t('applications:whatsapp.accepted', values)
    : i18n.t('applications:whatsapp.rejected', values)
}

/** `null` while the request is undecided or its number cannot be used for WhatsApp. */
export function decisionLink(application: ApplicationRow): string | null {
  if (application.status === 'pending') return null
  return whatsappUrl(application.phone, decisionMessage(application))
}
