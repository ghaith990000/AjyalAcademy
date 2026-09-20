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
import { DuplicateLocationError, type LocationRow } from './api'
import { useCreateLocation, useUpdateLocation } from './hooks'
import { locationSchema, toLocationInput, type LocationFormValues } from './schema'

const FORM_ID = 'location-form'

interface LocationDialogProps {
  /** Present = edit this location; absent = add a new one. */
  location?: LocationRow
  onClose: () => void
}

export function LocationDialog({ location, onClose }: LocationDialogProps) {
  const { t } = useTranslation(['locations', 'common', 'errors'])
  const toast = useToast()
  const create = useCreateLocation()
  const update = useUpdateLocation()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name ?? '',
      address: location?.address ?? '',
      active: location?.active ?? true,
    },
  })
  const message = (key?: string) =>
    key ? t(`locations:${key}` as ParseKeys<'locations'>) : undefined

  async function onSubmit(values: LocationFormValues) {
    const input = toLocationInput(values)
    try {
      if (location) await update.mutateAsync({ id: location.id, input })
      else await create.mutateAsync(input)
      toast({
        title: t(location ? 'locations:toast.updated' : 'locations:toast.created'),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      if (error instanceof DuplicateLocationError) {
        setError('name', { message: 'form.name.taken' })
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
      title={location ? t('locations:form.editTitle') : t('locations:form.createTitle')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {location ? t('locations:form.submitEdit') : t('locations:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('locations:form.name.label')}
          required
          error={message(errors.name?.message)}
        >
          {(c) => <Input {...c} {...register('name')} dir="auto" autoComplete="off" />}
        </Field>
        <Field
          label={t('locations:form.address.label')}
          hint={t('locations:form.address.hint')}
          error={message(errors.address?.message)}
        >
          {(c) => <Input {...c} {...register('address')} dir="auto" autoComplete="off" />}
        </Field>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField
              label={t('locations:form.active.label')}
              hint={t('locations:form.active.hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </form>
    </Dialog>
  )
}
