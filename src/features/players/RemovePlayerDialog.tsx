import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/toast-context'
import type { PlayerRow } from './api'
import { useRemovePlayer } from './hooks'

interface RemovePlayerDialogProps {
  player: PlayerRow
  onClose: () => void
  onRemoved: () => void
}

/** Soft delete behind a confirmation: the row stays, history is kept, the removal is logged. */
export function RemovePlayerDialog({ player, onClose, onRemoved }: RemovePlayerDialogProps) {
  const { t } = useTranslation(['players', 'common'])
  const toast = useToast()
  const remove = useRemovePlayer()

  async function confirm() {
    await remove.mutateAsync(player.id)
    toast({ title: t('players:toast.removed'), tone: 'success' })
    onRemoved()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('players:remove.title', { name: player.full_name })}
      description={t('players:remove.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => void confirm().catch(() => undefined)}
          >
            {t('players:remove.confirm')}
          </Button>
        </>
      }
    />
  )
}
