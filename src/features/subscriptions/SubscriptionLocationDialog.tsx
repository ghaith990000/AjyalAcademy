import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/toast-context'
import { LocationField } from '@/features/locations/LocationField'
import type { SubscriptionRow } from './api'
import { useSetSubscriptionLocation } from './hooks'
import { useSubscriptionError } from './useSubscriptionError'

interface SubscriptionLocationDialogProps {
  subscription: SubscriptionRow
  onClose: () => void
}

/** Admin only. Gives an older subscription its location, or corrects one; all its payments move with it. */
export function SubscriptionLocationDialog({
  subscription,
  onClose,
}: SubscriptionLocationDialogProps) {
  const { t } = useTranslation(['subscriptions', 'common', 'errors'])
  const toast = useToast()
  const setLocation = useSetSubscriptionLocation()
  const errorMessage = useSubscriptionError()
  const [locationId, setLocationId] = useState(subscription.location_id ?? '')
  const [touched, setTouched] = useState(false)
  const missing = touched && locationId === ''

  async function save() {
    setTouched(true)
    if (locationId === '') return
    try {
      await setLocation.mutateAsync({ id: subscription.id, locationId })
      toast({ title: t('subscriptions:locationDialog.toast.saved'), tone: 'success' })
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('subscriptions:locationDialog.title')}
      description={t('subscriptions:locationDialog.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button loading={setLocation.isPending} onClick={() => void save()}>
            {t('subscriptions:locationDialog.save')}
          </Button>
        </>
      }
    >
      <LocationField
        required
        select={{ value: locationId, onChange: (event) => setLocationId(event.target.value) }}
        currentId={subscription.location_id}
        error={missing ? t('subscriptions:error.location_required') : undefined}
      />
    </Dialog>
  )
}
