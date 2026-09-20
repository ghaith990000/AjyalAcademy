import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SwitchField } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/features/auth/useAuth'
import { useCoaches } from '@/features/coaches/hooks'
import { LocationField } from '@/features/locations/LocationField'
import { ajyalCodeOf, errorKeyOf } from '@/lib/errors'
import { DuplicateCprError, type PlayerRow } from './api'
import { useCreatePlayer, usePlayersBasePath, useUpdatePlayer } from './hooks'
import { playerSchema, toPlayerInput, type PlayerFormValues } from './schema'

const FORM_ID = 'player-form'

interface PlayerFormDialogProps {
  /** Present = edit this player; absent = add a new one. */
  player?: PlayerRow
  onClose: () => void
  /** Called with the saved player's id after a successful create/update. */
  onSaved?: (id: string) => void
}

export function PlayerFormDialog({ player, onClose, onSaved }: PlayerFormDialogProps) {
  const { t } = useTranslation(['players', 'common', 'errors', 'locations'])
  const toast = useToast()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const base = usePlayersBasePath()
  const create = useCreatePlayer()
  const update = useUpdatePlayer()
  const coaches = useCoaches({ enabled: isAdmin && !player })
  const [duplicate, setDuplicate] = useState<DuplicateCprError | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      full_name: player?.full_name ?? '',
      cpr: player?.cpr ?? '',
      date_of_birth: player?.date_of_birth ?? '',
      address: player?.address ?? '',
      school: player?.school ?? '',
      location_id: player?.location_id ?? '',
      phone: player?.phone ?? '',
      guardian_name: player?.guardian_name ?? '',
      has_disease: player?.has_disease ?? false,
      disease_description: player?.disease_description ?? '',
      coach_id: '',
    },
  })
  const hasDisease = useWatch({ control, name: 'has_disease' })

  const message = (key?: string) => (key ? t(`players:${key}` as ParseKeys<'players'>) : undefined)

  async function onSubmit(values: PlayerFormValues) {
    setDuplicate(null)
    try {
      let id: string
      if (player) {
        await update.mutateAsync({
          id: player.id,
          input: toPlayerInput(values, { includeCoach: false }),
        })
        id = player.id
        toast({ title: t('players:toast.updated'), tone: 'success' })
      } else {
        ;({ id } = await create.mutateAsync(toPlayerInput(values, { includeCoach: isAdmin })))
        toast({ title: t('players:toast.created'), tone: 'success' })
      }
      onSaved?.(id)
      onClose()
    } catch (error) {
      if (error instanceof DuplicateCprError) {
        setDuplicate(error)
        setError('cpr', { message: 'form.duplicate.taken' })
      } else if (ajyalCodeOf(error) === 'invalid_location') {
        setError('location_id', { message: 'form.location.invalid' })
      } else {
        toast({
          title: t('errors:title'),
          description: t(`errors:${errorKeyOf(error)}`),
          tone: 'error',
        })
      }
    }
  }

  // A duplicate CPR links to the existing player when the caller may see it (RLS decides).
  let cprError: ReactNode = message(errors.cpr?.message)
  if (duplicate && errors.cpr?.message === 'form.duplicate.taken') {
    cprError = (
      <>
        {t('players:form.duplicate.taken')}{' '}
        {duplicate.existing ? (
          <Link
            to={`${base}/${duplicate.existing.id}`}
            onClick={onClose}
            className="font-bold underline"
          >
            {t('players:form.duplicate.open', { name: duplicate.existing.full_name })}
          </Link>
        ) : (
          t('players:form.duplicate.hidden')
        )}
      </>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={player ? t('players:form.editTitle') : t('players:form.createTitle')}
      description={player ? undefined : t('players:form.createDescription')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {player ? t('players:form.submitEdit') : t('players:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('players:form.fullName.label')}
          required
          error={message(errors.full_name?.message)}
        >
          {(c) => <Input {...c} {...register('full_name')} dir="auto" autoComplete="off" />}
        </Field>

        <Field
          label={t('players:form.cpr.label')}
          hint={t('players:form.cpr.hint')}
          required
          error={cprError}
        >
          {(c) => (
            <Input
              {...c}
              {...register('cpr', { onChange: () => setDuplicate(null) })}
              inputMode="numeric"
              maxLength={9}
              autoComplete="off"
              ltr
            />
          )}
        </Field>

        <Field
          label={t('players:form.dob.label')}
          required
          error={message(errors.date_of_birth?.message)}
        >
          {(c) => <Input {...c} {...register('date_of_birth')} type="date" ltr />}
        </Field>

        <Field
          label={t('players:form.phone.label')}
          hint={t('players:form.phone.hint')}
          required
          error={message(errors.phone?.message)}
        >
          {(c) => (
            <Input
              {...c}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              ltr
              placeholder={t('players:form.phone.placeholder')}
            />
          )}
        </Field>

        <Field
          label={t('players:form.guardianName.label')}
          error={message(errors.guardian_name?.message)}
        >
          {(c) => <Input {...c} {...register('guardian_name')} dir="auto" autoComplete="off" />}
        </Field>

        <Field label={t('players:form.school.label')} error={message(errors.school?.message)}>
          {(c) => <Input {...c} {...register('school')} dir="auto" autoComplete="off" />}
        </Field>

        <Field label={t('players:form.address.label')} error={message(errors.address?.message)}>
          {(c) => <Input {...c} {...register('address')} dir="auto" autoComplete="off" />}
        </Field>

        <LocationField
          select={register('location_id')}
          currentId={player?.location_id}
          emptyLabel={t('locations:select.none')}
          error={message(errors.location_id?.message)}
        />

        <div className="space-y-3 rounded-card border border-line bg-page p-3.5">
          <Controller
            control={control}
            name="has_disease"
            render={({ field }) => (
              <SwitchField
                label={t('players:form.disease.label')}
                hint={t('players:form.disease.hint')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {hasDisease && (
            <Field
              label={t('players:form.diseaseDescription.label')}
              required
              error={message(errors.disease_description?.message)}
            >
              {(c) => (
                <Textarea
                  {...c}
                  {...register('disease_description')}
                  placeholder={t('players:form.diseaseDescription.placeholder')}
                />
              )}
            </Field>
          )}
        </div>

        {isAdmin && !player && (
          <Field label={t('players:form.coach.label')} hint={t('players:form.coach.hint')}>
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
        )}
      </form>
    </Dialog>
  )
}
