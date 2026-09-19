import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SwitchField } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/toast-context'
import { errorKeyOf } from '@/lib/errors'
import { DEFAULT_LANGUAGE } from '@/lib/i18n'
import { fromBD, toBD } from '@/lib/money'
import { CreateCoachError, type Coach } from './api'
import { useCreateCoach, useUpdateCoach } from './hooks'
import {
  createCoachSchema,
  editCoachSchema,
  type CreateCoachValues,
  type EditCoachValues,
} from './schema'

interface DialogProps {
  onClose: () => void
}

/** Translate a schema message key (`form.email.invalid`) from the `coaches` namespace. */
function useMessage() {
  const { t } = useTranslation('coaches')
  return (key?: string) => (key ? t(key as ParseKeys<'coaches'>) : undefined)
}

const FORM_ID = 'coach-form'

export function CreateCoachDialog({ onClose }: DialogProps) {
  const { t } = useTranslation(['coaches', 'common', 'errors'])
  const message = useMessage()
  const toast = useToast()
  const create = useCreateCoach()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCoachValues>({
    resolver: zodResolver(createCoachSchema),
    defaultValues: { full_name: '', email: '', password: '', phone: '', salary: '0' },
  })

  async function onSubmit(values: CreateCoachValues) {
    try {
      await create.mutateAsync({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        phone: values.phone || null,
        monthly_salary_fils: fromBD(values.salary),
        preferred_language: DEFAULT_LANGUAGE,
      })
      toast({
        title: t('coaches:toast.created'),
        description: t('coaches:toast.createdDescription', { name: values.full_name }),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      if (error instanceof CreateCoachError && error.code === 'email_taken') {
        setError('email', { message: 'form.email.taken' })
      } else if (error instanceof CreateCoachError && error.code === 'weak_password') {
        setError('password', { message: 'form.password.weak' })
      } else {
        toast({
          title: t('errors:title'),
          description: t(`errors:${errorKeyOf(error)}`),
          tone: 'error',
        })
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('coaches:form.createTitle')}
      description={t('coaches:form.createDescription')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {t('coaches:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('coaches:form.fullName.label')}
          required
          error={message(errors.full_name?.message)}
        >
          {(control) => (
            <Input {...control} {...register('full_name')} dir="auto" autoComplete="off" />
          )}
        </Field>
        <Field
          label={t('coaches:form.email.label')}
          required
          error={message(errors.email?.message)}
        >
          {(control) => (
            <Input
              {...control}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
              ltr
              placeholder={t('coaches:form.email.placeholder')}
            />
          )}
        </Field>
        <Field
          label={t('coaches:form.password.label')}
          hint={t('coaches:form.password.hint')}
          required
          error={message(errors.password?.message)}
        >
          {(control) => (
            <Input
              {...control}
              {...register('password')}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              ltr
            />
          )}
        </Field>
        <Field label={t('coaches:form.phone.label')} error={message(errors.phone?.message)}>
          {(control) => (
            <Input
              {...control}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              ltr
              placeholder={t('coaches:form.phone.placeholder')}
            />
          )}
        </Field>
        <Field
          label={t('coaches:form.salary.label')}
          hint={t('coaches:form.salary.hint')}
          required
          error={message(errors.salary?.message)}
        >
          {(control) => <Input {...control} {...register('salary')} inputMode="decimal" ltr />}
        </Field>
      </form>
    </Dialog>
  )
}

export function EditCoachDialog({ coach, onClose }: DialogProps & { coach: Coach }) {
  const { t } = useTranslation(['coaches', 'common'])
  const message = useMessage()
  const toast = useToast()
  const update = useUpdateCoach()
  const {
    register,
    control: formControl,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCoachValues>({
    resolver: zodResolver(editCoachSchema),
    defaultValues: {
      full_name: coach.full_name,
      phone: coach.phone ?? '',
      salary: String(toBD(coach.monthly_salary_fils)),
      active: coach.active,
    },
  })

  async function onSubmit(values: EditCoachValues) {
    try {
      await update.mutateAsync({
        id: coach.id,
        changes: {
          full_name: values.full_name,
          phone: values.phone || null,
          monthly_salary_fils: fromBD(values.salary),
          active: values.active,
        },
      })
      toast({ title: t('coaches:toast.updated'), tone: 'success' })
      onClose()
    } catch {
      // The global mutation error handler already showed a translated toast; keep the form open.
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('coaches:form.editTitle')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {t('coaches:form.submitEdit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={t('coaches:form.email.label')}>
          {(control) => <Input {...control} value={coach.email} readOnly disabled ltr />}
        </Field>
        <Field
          label={t('coaches:form.fullName.label')}
          required
          error={message(errors.full_name?.message)}
        >
          {(control) => <Input {...control} {...register('full_name')} dir="auto" />}
        </Field>
        <Field label={t('coaches:form.phone.label')} error={message(errors.phone?.message)}>
          {(control) => (
            <Input
              {...control}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              ltr
              placeholder={t('coaches:form.phone.placeholder')}
            />
          )}
        </Field>
        <Field
          label={t('coaches:form.salary.label')}
          hint={t('coaches:form.salary.hint')}
          required
          error={message(errors.salary?.message)}
        >
          {(control) => <Input {...control} {...register('salary')} inputMode="decimal" ltr />}
        </Field>
        <Controller
          control={formControl}
          name="active"
          render={({ field }) => (
            <SwitchField
              label={t('coaches:form.active.label')}
              hint={t('coaches:form.active.hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </form>
    </Dialog>
  )
}
