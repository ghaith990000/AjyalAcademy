import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/toast-context'
import { useCancelSession } from './hooks'
import { useSessionError } from './useSessionError'

interface CancelSessionDialogProps {
  sessionId: string
  onClose: () => void
}

/** Cancelling is final: attendance can no longer be taken and the session cannot be reopened. */
export function CancelSessionDialog({ sessionId, onClose }: CancelSessionDialogProps) {
  const { t } = useTranslation(['sessions', 'errors'])
  const toast = useToast()
  const cancel = useCancelSession()
  const errorMessage = useSessionError()

  async function confirm() {
    try {
      await cancel.mutateAsync(sessionId)
      toast({ title: t('sessions:toast.cancelled'), tone: 'success' })
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('sessions:cancelDialog.title')}
      description={t('sessions:cancelDialog.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('sessions:cancelDialog.keep')}
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => void confirm()}>
            {t('sessions:cancelDialog.confirm')}
          </Button>
        </>
      }
    />
  )
}
