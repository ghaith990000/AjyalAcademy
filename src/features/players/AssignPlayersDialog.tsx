import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/toast-context'
import { useCoaches } from '@/features/coaches/hooks'
import { useAssignPlayers } from './hooks'

const UNASSIGN = '__unassign__'

interface AssignPlayersDialogProps {
  playerIds: string[]
  onClose: () => void
  /** Called after the assignment succeeded (e.g. to clear the list selection). */
  onDone?: () => void
}

/** Bulk assign from the list: pick one coach (or "unassign") for every selected player. */
export function AssignPlayersDialog({ playerIds, onClose, onDone }: AssignPlayersDialogProps) {
  const { t } = useTranslation(['players', 'common'])
  const toast = useToast()
  const coaches = useCoaches()
  const assign = useAssignPlayers()
  const [choice, setChoice] = useState('')

  async function submit() {
    const changed = await assign.mutateAsync({
      ids: playerIds,
      coachId: choice === UNASSIGN ? null : choice,
    })
    toast(
      changed > 0
        ? {
            title: t('players:toast.assigned'),
            description: t('players:toast.assignedDescription', { n: changed }),
            tone: 'success',
          }
        : {
            title: t('players:toast.nothingToAssign'),
            description: t('players:toast.nothingToAssignDescription'),
            tone: 'info',
          },
    )
    onDone?.()
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('players:assign.title')}
      description={t('players:assign.bulkDescription', { n: playerIds.length })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={() => void submit().catch(() => undefined)}
            loading={assign.isPending}
            disabled={!choice}
          >
            {t('players:assign.submit')}
          </Button>
        </>
      }
    >
      <Field label={t('players:assign.coach.label')} required>
        {(c) => (
          <Select {...c} value={choice} onChange={(event) => setChoice(event.target.value)}>
            <option value="" disabled>
              {t('players:assign.coach.choose')}
            </option>
            {coaches.data
              ?.filter((coach) => coach.active)
              .map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name}
                </option>
              ))}
            <option value={UNASSIGN}>{t('players:assign.coach.unassign')}</option>
          </Select>
        )}
      </Field>
    </Dialog>
  )
}
