import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { TriangleAlert } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import { formatDate, formatTimeRange, todayISO } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import type { SessionRow } from './api'
import { useCoachSessionsBetween, useCreateSessions, useUpdateSession } from './hooks'
import { findConflicts, hhmm } from './schedule'
import {
  MAX_REPEAT_WEEKS,
  MIN_REPEAT_WEEKS,
  sessionSchema,
  toSessionInputs,
  type SessionFormValues,
} from './schema'
import { useSessionError } from './useSessionError'

const FORM_ID = 'session-form'
const MAX_LISTED_CONFLICTS = 3

interface SessionFormDialogProps {
  /** Present = edit this session; absent = schedule new one(s). */
  session?: SessionRow
  onClose: () => void
}

export function SessionFormDialog({ session, onClose }: SessionFormDialogProps) {
  const { t } = useTranslation(['sessions', 'common', 'errors'])
  const { language } = useLanguage()
  const toast = useToast()
  const errorMessage = useSessionError()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const coaches = useCoaches({ enabled: isAdmin })
  const create = useCreateSessions()
  const update = useUpdateSession()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      session_date: session?.session_date ?? todayISO(),
      start_time: session ? hhmm(session.start_time) : '',
      end_time: session ? hhmm(session.end_time) : '',
      // A coach only ever schedules for themself; an admin picks.
      coach_id: session?.coach_id ?? (isAdmin ? '' : (profile?.id ?? '')),
      location_id: session?.location_id ?? '',
      notes: session?.notes ?? '',
      repeat: false,
      repeat_weeks: '4',
    },
  })
  const values = useWatch({ control })
  const repeat = values.repeat === true

  // Overlap warning: never blocks, just tells the person before they save.
  // The warning does not depend on the location, so a form still missing it gets the warning too.
  const parsed = sessionSchema.safeParse({
    ...values,
    location_id: values.location_id || 'pending',
  })
  const candidates = parsed.success ? toSessionInputs(parsed.data) : []
  const coachForCheck = parsed.success ? parsed.data.coach_id : ''
  const existing = useCoachSessionsBetween(
    coachForCheck,
    candidates[0]?.session_date ?? '',
    candidates.at(-1)?.session_date ?? '',
    { enabled: candidates.length > 0 },
  )
  const conflicts = existing.data
    ? findConflicts(
        candidates,
        existing.data.filter((other) => other.id !== session?.id),
      )
    : []

  const message = (key?: string) =>
    key ? t(`sessions:${key}` as ParseKeys<'sessions'>) : undefined

  async function onSubmit(formValues: SessionFormValues) {
    const inputs = toSessionInputs(formValues)
    try {
      if (session) {
        await update.mutateAsync({ id: session.id, input: inputs[0]! })
        toast({ title: t('sessions:toast.updated'), tone: 'success' })
      } else {
        await create.mutateAsync(inputs)
        toast({
          title:
            inputs.length > 1
              ? t('sessions:toast.createdMany', { n: inputs.length })
              : t('sessions:toast.created'),
          tone: 'success',
        })
      }
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  // Keep the current coach selectable even if they were deactivated since.
  const coachOptions = (coaches.data ?? []).filter(
    (coach) => coach.active || coach.id === session?.coach_id,
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={session ? t('sessions:form.editTitle') : t('sessions:form.createTitle')}
      description={session ? undefined : t('sessions:form.createDescription')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {session ? t('sessions:form.submitEdit') : t('sessions:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('sessions:form.date.label')}
          required
          error={message(errors.session_date?.message)}
        >
          {(c) => <Input {...c} {...register('session_date')} type="date" ltr />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('sessions:form.startTime.label')}
            required
            error={message(errors.start_time?.message)}
          >
            {(c) => <Input {...c} {...register('start_time')} type="time" ltr />}
          </Field>
          <Field
            label={t('sessions:form.endTime.label')}
            required
            error={message(errors.end_time?.message)}
          >
            {(c) => <Input {...c} {...register('end_time')} type="time" ltr />}
          </Field>
        </div>

        {isAdmin && (
          <Field
            label={t('sessions:form.coach.label')}
            hint={t('sessions:form.coach.hint')}
            required
            error={message(errors.coach_id?.message)}
          >
            {(c) => (
              <Select {...c} {...register('coach_id')}>
                <option value="">{t('sessions:form.coach.placeholder')}</option>
                {coachOptions.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <LocationField
          required
          select={register('location_id')}
          currentId={session?.location_id}
          error={message(errors.location_id?.message)}
        />

        <Field label={t('sessions:form.notes.label')} error={message(errors.notes?.message)}>
          {(c) => <Textarea {...c} {...register('notes')} rows={3} />}
        </Field>

        {!session && (
          <div className="space-y-3 rounded-card border border-line bg-page p-3.5">
            <Controller
              control={control}
              name="repeat"
              render={({ field }) => (
                <SwitchField
                  label={t('sessions:form.repeat.label')}
                  hint={t('sessions:form.repeat.hint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {repeat && (
              <Field
                label={t('sessions:form.repeatWeeks.label')}
                hint={t('sessions:form.repeatWeeks.hint')}
                required
                error={message(errors.repeat_weeks?.message)}
              >
                {(c) => (
                  <Input
                    {...c}
                    {...register('repeat_weeks')}
                    type="number"
                    inputMode="numeric"
                    min={MIN_REPEAT_WEEKS}
                    max={MAX_REPEAT_WEEKS}
                    ltr
                  />
                )}
              </Field>
            )}
          </div>
        )}

        {conflicts.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-50 p-3.5"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 text-[15px]">
              <p className="font-semibold text-warning">{t('sessions:form.conflict.title')}</p>
              <ul className="mt-1 space-y-0.5">
                {conflicts.slice(0, MAX_LISTED_CONFLICTS).map((other) => (
                  <li key={other.id}>
                    <bdi>
                      {formatDate(other.session_date)} ·{' '}
                      {formatTimeRange(other.start_time, other.end_time, language)}
                    </bdi>
                  </li>
                ))}
              </ul>
              {conflicts.length > MAX_LISTED_CONFLICTS && (
                <p>
                  {t('sessions:form.conflict.more', { n: conflicts.length - MAX_LISTED_CONFLICTS })}
                </p>
              )}
              <p className="mt-1 text-ink-muted">{t('sessions:form.conflict.hint')}</p>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}
