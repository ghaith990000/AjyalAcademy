import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { CircleCheck, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CheckboxField } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SwitchField } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { ajyalCodeOf, errorKeyOf } from '@/lib/errors'
import { useLanguage } from '@/lib/useLanguage'
import { submitApplications } from './api'
import { usePublicLocations } from './hooks'
import {
  createRegisterSchema,
  emptyChild,
  MAX_CHILDREN,
  toChildInput,
  type RegisterFormValues,
} from './schema'

type Failure = 'network' | 'rateLimited' | 'invalid' | 'duplicateChild' | 'generic'

/** What a person is told when sending fails (the form and its answers stay as they are). */
function failureOf(error: unknown): Failure | 'invalidLocation' {
  switch (ajyalCodeOf(error)) {
    case 'rate_limited':
      return 'rateLimited'
    case 'duplicate_child':
      return 'duplicateChild'
    case 'invalid_location':
      return 'invalidLocation'
    case 'invalid_input':
    case 'too_many_children':
      return 'invalid'
    default:
      return errorKeyOf(error) === 'network' ? 'network' : 'generic'
  }
}

interface Sent {
  names: string[]
  phone: string
}

interface ChildCardProps {
  index: number
  control: Control<RegisterFormValues>
  removable: boolean
  onRemove: () => void
  register: UseFormRegister<RegisterFormValues>
  errors: FieldErrors<RegisterFormValues>
  message: (key?: string) => string | undefined
}

function ChildCard({
  index,
  control,
  removable,
  onRemove,
  register,
  errors,
  message,
}: ChildCardProps) {
  const { t } = useTranslation('register')
  const hasDisease = useWatch({ control, name: `children.${index}.has_disease` })
  const own = errors.children?.[index]
  const heading = `child-${index}-title`

  return (
    <Card role="group" aria-labelledby={heading} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={heading} className="text-lg font-bold text-ink">
          {t('child.title', { n: index + 1 })}
        </h2>
        {removable && (
          <IconButton
            label={t('child.remove', { n: index + 1 })}
            icon={<Trash2 className="size-5" aria-hidden />}
            onClick={onRemove}
          />
        )}
      </div>

      <Field label={t('child.fullName.label')} required error={message(own?.full_name?.message)}>
        {(c) => (
          <Input
            {...c}
            {...register(`children.${index}.full_name`)}
            dir="auto"
            autoComplete="off"
          />
        )}
      </Field>

      <Field
        label={t('child.cpr.label')}
        hint={t('child.cpr.hint')}
        required
        error={message(own?.cpr?.message)}
      >
        {(c) => (
          <Input
            {...c}
            {...register(`children.${index}.cpr`)}
            inputMode="numeric"
            maxLength={9}
            autoComplete="off"
            ltr
          />
        )}
      </Field>

      <Field label={t('child.dob.label')} required error={message(own?.date_of_birth?.message)}>
        {(c) => <Input {...c} {...register(`children.${index}.date_of_birth`)} type="date" ltr />}
      </Field>

      <Field label={t('child.school.label')} error={message(own?.school?.message)}>
        {(c) => (
          <Input {...c} {...register(`children.${index}.school`)} dir="auto" autoComplete="off" />
        )}
      </Field>

      <Field label={t('child.address.label')} error={message(own?.address?.message)}>
        {(c) => (
          <Input {...c} {...register(`children.${index}.address`)} dir="auto" autoComplete="off" />
        )}
      </Field>

      <div className="space-y-3 rounded-card border border-line bg-page p-3.5">
        <Controller
          control={control}
          name={`children.${index}.has_disease`}
          render={({ field }) => (
            <SwitchField
              label={t('child.disease.label')}
              hint={t('child.disease.hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        {hasDisease && (
          <Field
            label={t('child.diseaseDescription.label')}
            required
            error={message(own?.disease_description?.message)}
          >
            {(c) => (
              <Textarea
                {...c}
                {...register(`children.${index}.disease_description`)}
                placeholder={t('child.diseaseDescription.placeholder')}
              />
            )}
          </Field>
        )}
      </div>
    </Card>
  )
}

function listOf(names: string[], language: 'ar' | 'en'): string {
  const locale = language === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB'
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
}

/**
 * The public registration form — no login. A parent enters their own details once and up to four children; each
 * child becomes a request that an admin accepts or rejects. Nothing is stored until "Send", and a failed send
 * (no connection, too many requests) keeps every answer on screen so it can be tried again.
 */
export default function RegisterPage() {
  const { t } = useTranslation(['register', 'common'])
  const { language } = useLanguage()
  const locations = usePublicLocations()
  // One id per form: pressing "Send" again after a dropped connection is recognised and stored only once.
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const [failure, setFailure] = useState<Failure | null>(null)
  const [sent, setSent] = useState<Sent | null>(null)

  const locationOptions = locations.data ?? []
  const locationRequired = locationOptions.length > 0
  const schema = useMemo(() => createRegisterSchema({ locationRequired }), [locationRequired])

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guardian_name: '',
      phone: '',
      location_id: '',
      children: [emptyChild()],
      confirm: false,
      website: '',
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'children' })

  const message = (key?: string) =>
    key ? t(`register:${key}` as ParseKeys<'register'>) : undefined

  async function onSubmit(values: RegisterFormValues) {
    setFailure(null)
    try {
      await submitApplications({
        submissionId,
        guardianName: values.guardian_name,
        phone: values.phone,
        locationId: values.location_id === '' ? null : values.location_id,
        language,
        children: values.children.map(toChildInput),
        website: values.website,
      })
      setSent({ names: values.children.map((child) => child.full_name), phone: values.phone })
    } catch (error) {
      const reason = failureOf(error)
      if (reason === 'invalidLocation') {
        setError('location_id', { message: 'form.location.invalid' })
      } else {
        setFailure(reason)
      }
    }
  }

  function another() {
    reset()
    setSubmissionId(crypto.randomUUID())
    setFailure(null)
    setSent(null)
  }

  if (sent) {
    return (
      <Card className="space-y-4 py-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-50 text-success">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold text-ink">{t('register:done.title')}</h1>
        <p role="status" className="mx-auto max-w-md text-ink">
          <Trans
            t={t}
            i18nKey="register:done.received"
            values={{ names: listOf(sent.names, language) }}
            components={{ b: <bdi className="font-semibold" /> }}
          />
        </p>
        <p className="mx-auto max-w-md text-ink-muted">
          <Trans
            t={t}
            i18nKey="register:done.contact"
            values={{ phone: sent.phone }}
            components={{ b: <bdi dir="ltr" className="font-semibold text-ink" /> }}
          />
        </p>
        <div className="pt-2">
          <Button variant="secondary" size="lg" onClick={another}>
            {t('register:done.another')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold text-ink md:text-[28px]">{t('register:title')}</h1>
        <p className="mt-1 text-ink-muted">{t('register:subtitle')}</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-ink">{t('register:parent.title')}</h2>
        <Field
          label={t('register:parent.name.label')}
          required
          error={message(errors.guardian_name?.message)}
        >
          {(c) => <Input {...c} {...register('guardian_name')} dir="auto" autoComplete="name" />}
        </Field>
        <Field
          label={t('register:parent.phone.label')}
          hint={t('register:parent.phone.hint')}
          required
          error={message(errors.phone?.message)}
        >
          {(c) => (
            <Input
              {...c}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              ltr
              placeholder={t('register:parent.phone.placeholder')}
            />
          )}
        </Field>
        {locationRequired && (
          <Field
            label={t('register:parent.location.label')}
            hint={t('register:parent.location.hint')}
            required
            error={message(errors.location_id?.message)}
          >
            {(c) => (
              <Select {...c} {...register('location_id')}>
                <option value="">{t('register:parent.location.placeholder')}</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </Card>

      {fields.map((field, index) => (
        <ChildCard
          key={field.id}
          index={index}
          control={control}
          register={register}
          errors={errors}
          message={message}
          removable={fields.length > 1}
          onRemove={() => remove(index)}
        />
      ))}

      {fields.length < MAX_CHILDREN ? (
        <Button variant="secondary" size="lg" fullWidth onClick={() => append(emptyChild())}>
          <Plus className="size-5" aria-hidden />
          {t('register:add.button')}
        </Button>
      ) : (
        <p className="text-center text-[15px] text-ink-muted">
          {t('register:add.limit', { max: MAX_CHILDREN })}
        </p>
      )}

      <Card className="space-y-2">
        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <CheckboxField
              label={t('register:confirm.label')}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        {errors.confirm?.message && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {message(errors.confirm.message)}
          </p>
        )}
      </Card>

      {/* A trap for programs, not people: hidden from everyone, so anything typed here came from a bot. */}
      <div aria-hidden className="absolute size-0 overflow-hidden opacity-0">
        <label>
          {t('register:trap')}
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>

      {failure && (
        <p
          role="alert"
          className="rounded-control bg-danger-50 px-3.5 py-3 text-[15px] font-medium text-danger"
        >
          {t(`register:error.${failure}`)}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {t('register:submit')}
      </Button>
      <p className="text-center text-[13px] text-ink-muted">{t('register:privacy')}</p>
    </form>
  )
}
