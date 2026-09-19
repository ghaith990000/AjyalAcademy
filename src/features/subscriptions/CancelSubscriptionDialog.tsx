import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import type { SubscriptionRow } from './api'
import { useCancelSubscription } from './hooks'
import { useSubscriptionError } from './useSubscriptionError'

interface CancelSubscriptionDialogProps {
  subscription: SubscriptionRow
  onClose: () => void
}

/** Soft cancel: a reason is required, payments are kept, and the players' dates become free again. */
export function CancelSubscriptionDialog({ subscription, onClose }: CancelSubscriptionDialogProps) {
  const { t } = useTranslation(['subscriptions', 'common', 'errors'])
  const toast = useToast()
  const cancel = useCancelSubscription()
  const errorMessage = useSubscriptionError()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const missing = touched && reason.trim() === ''

  async function confirm() {
    setTouched(true)
    if (reason.trim() === '') return
    try {
      await cancel.mutateAsync({ id: subscription.id, reason: reason.trim() })
      toast({ title: t('subscriptions:cancelDialog.toast.cancelled'), tone: 'success' })
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('subscriptions:cancelDialog.title')}
      description={t('subscriptions:cancelDialog.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('subscriptions:cancelDialog.keep')}
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => void confirm()}>
            {t('subscriptions:cancelDialog.confirm')}
          </Button>
        </>
      }
    >
      <Field
        label={t('subscriptions:cancelDialog.reason.label')}
        required
        error={missing ? t('subscriptions:cancelDialog.reason.required') : undefined}
      >
        {(c) => (
          <Textarea
            {...c}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
          />
        )}
      </Field>
    </Dialog>
  )
}
