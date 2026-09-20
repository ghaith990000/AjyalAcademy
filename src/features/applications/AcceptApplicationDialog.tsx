import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/toast-context'
import { useCoaches } from '@/features/coaches/hooks'
import { LocationField } from '@/features/locations/LocationField'
import { CprTakenError, type ApplicationRow } from './api'
import { useAcceptApplication } from './hooks'
import { useApplicationError } from './useApplicationError'

const FORM_ID = 'accept-application-form'

interface FormValues {
  coach_id: string
  location_id: string
}

interface AcceptApplicationDialogProps {
  application: ApplicationRow
  onClose: () => void
}

/**
 * Accepting creates the player. The admin may give them a coach right away (or later, as for any player) and
 * confirm the location the parent asked for.
 */
export function AcceptApplicationDialog({ application, onClose }: AcceptApplicationDialogProps) {
  const { t } = useTranslation(['applications', 'common', 'players', 'locations'])
  const toast = useToast()
  const accept = useAcceptApplication()
  const explain = useApplicationError()
  const coaches = useCoaches()
  const [refusal, setRefusal] = useState<string | null>(null)
  const [taken, setTaken] = useState<CprTakenError | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { coach_id: '', location_id: application.location_id ?? '' },
  })

  async function onSubmit(values: FormValues) {
    setRefusal(null)
    setTaken(null)
    try {
      await accept.mutateAsync({
        id: application.id,
        coachId: values.coach_id === '' ? null : values.coach_id,
        locationId: values.location_id === '' ? null : values.location_id,
      })
      toast({
        title: t('applications:toast.accepted', { name: application.full_name }),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      if (error instanceof CprTakenError) setTaken(error)
      else setRefusal(explain(error))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('applications:accept.title', { name: application.full_name })}
      description={t('applications:accept.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {t('applications:accept.confirm')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {taken && (
          <div
            role="alert"
            className="rounded-control bg-danger-50 px-3.5 py-3 text-[15px] font-medium text-danger"
          >
            <p>{t('applications:accept.cprTaken')}</p>
            {taken.playerId && (
              <Link
                to={`/admin/players/${taken.playerId}`}
                className="inline-flex min-h-11 items-center font-bold underline"
              >
                {t('applications:accept.openExisting')}
              </Link>
            )}
          </div>
        )}
        {refusal && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 px-3.5 py-3 text-[15px] font-medium text-danger"
          >
            {refusal}
          </p>
        )}
        <Field
          label={t('applications:accept.coach.label')}
          hint={t('applications:accept.coach.hint')}
        >
          {(c) => (
            <Select {...c} {...register('coach_id')}>
              <option value="">{t('players:unassigned')}</option>
              {coaches.data
                ?.filter((coach) => coach.active)
                .map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <LocationField
          select={register('location_id')}
          currentId={application.location_id}
          emptyLabel={t('locations:select.none')}
          hint={t('applications:accept.location.hint')}
        />
      </form>
    </Dialog>
  )
}
