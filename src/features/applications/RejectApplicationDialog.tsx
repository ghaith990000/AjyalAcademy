import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import type { ApplicationRow } from './api'
import { useRejectApplication } from './hooks'
import { useApplicationError } from './useApplicationError'

const FORM_ID = 'reject-application-form'
const NOTE_MAX = 500

interface RejectApplicationDialogProps {
  application: ApplicationRow
  onClose: () => void
}

/** Rejecting keeps the request (with an optional note for the team); the parent is told by the admin. */
export function RejectApplicationDialog({ application, onClose }: RejectApplicationDialogProps) {
  const { t } = useTranslation(['applications', 'common'])
  const toast = useToast()
  const reject = useRejectApplication()
  const explain = useApplicationError()
  const [refusal, setRefusal] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ note: string }>({ defaultValues: { note: '' } })

  async function onSubmit(values: { note: string }) {
    setRefusal(null)
    try {
      await reject.mutateAsync({ id: application.id, note: values.note })
      toast({
        title: t('applications:toast.rejected', { name: application.full_name }),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      setRefusal(explain(error))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('applications:reject.title', { name: application.full_name })}
      description={t('applications:reject.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="danger" type="submit" form={FORM_ID} loading={isSubmitting}>
            {t('applications:reject.confirm')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {refusal && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 px-3.5 py-3 text-[15px] font-medium text-danger"
          >
            {refusal}
          </p>
        )}
        <Field
          label={t('applications:reject.note.label')}
          hint={t('applications:reject.note.hint')}
        >
          {(c) => <Textarea {...c} {...register('note')} maxLength={NOTE_MAX} />}
        </Field>
      </form>
    </Dialog>
  )
}
