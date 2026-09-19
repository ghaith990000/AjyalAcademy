import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { CloudOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast-context'
import { parseBD, toBD } from '@/lib/money'
import type { Plan, Settings } from './api'
import { usePlans, useSaveSettings, useSettings } from './hooks'
import { settingsSchema, type SettingsValues } from './schema'

const PLAN_CODES = ['solo', 'duo', 'trio', 'quad'] as const

const bdText = (fils: number) => String(toBD(fils))

function SettingsForm({ plans, settings }: { plans: Plan[]; settings: Settings }) {
  const { t } = useTranslation(['settings', 'common'])
  const toast = useToast()
  const save = useSaveSettings()
  const planByCode = new Map(plans.map((plan) => [plan.code, plan]))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      solo: bdText(planByCode.get('solo')?.price_fils ?? 0),
      duo: bdText(planByCode.get('duo')?.price_fils ?? 0),
      trio: bdText(planByCode.get('trio')?.price_fils ?? 0),
      quad: bdText(planByCode.get('quad')?.price_fils ?? 0),
      tshirt: bdText(settings.tshirt_fee_fils),
      transport: bdText(settings.transport_fee_fils),
      expiringDays: String(settings.expiring_soon_days),
    },
  })

  const message = (key?: string) =>
    key ? t(`settings:${key}` as ParseKeys<'settings'>) : undefined

  async function onSubmit(values: SettingsValues) {
    try {
      await save.mutateAsync({
        planPrices: PLAN_CODES.flatMap((code) => {
          const plan = planByCode.get(code)
          return plan ? [{ id: plan.id, price_fils: parseBD(values[code]) ?? plan.price_fils }] : []
        }),
        tshirt_fee_fils: parseBD(values.tshirt) ?? settings.tshirt_fee_fils,
        transport_fee_fils: parseBD(values.transport) ?? settings.transport_fee_fils,
        expiring_soon_days: Number(values.expiringDays),
      })
      toast({ title: t('settings:toast.saved'), tone: 'success' })
      reset(values) // the saved values are the new baseline
    } catch {
      // the global mutation error handler already showed a translated toast
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Card>
        <CardTitle>{t('settings:plans.title')}</CardTitle>
        <p className="mt-1 text-[15px] text-ink-muted">{t('settings:plans.hint')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PLAN_CODES.map((code) => (
            <Field
              key={code}
              label={t(`settings:plans.${code}`)}
              required
              error={message(errors[code]?.message)}
            >
              {(c) => <Input {...c} {...register(code)} inputMode="decimal" ltr />}
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings:fees.title')}</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label={t('settings:fees.tshirt.label')}
            hint={t('settings:fees.tshirt.hint')}
            required
            error={message(errors.tshirt?.message)}
          >
            {(c) => <Input {...c} {...register('tshirt')} inputMode="decimal" ltr />}
          </Field>
          <Field
            label={t('settings:fees.transport.label')}
            hint={t('settings:fees.transport.hint')}
            required
            error={message(errors.transport?.message)}
          >
            {(c) => <Input {...c} {...register('transport')} inputMode="decimal" ltr />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings:reminders.title')}</CardTitle>
        <div className="mt-4 max-w-xs">
          <Field
            label={t('settings:reminders.expiring.label')}
            hint={t('settings:reminders.expiring.hint')}
            required
            error={message(errors.expiringDays?.message)}
          >
            {(c) => <Input {...c} {...register('expiringDays')} inputMode="numeric" ltr />}
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting} disabled={!isDirty}>
          {t('settings:save')}
        </Button>
      </div>
    </form>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'nav', 'common'])
  const plans = usePlans()
  const settings = useSettings()

  let body
  if (plans.isError || settings.isError) {
    body = (
      <Card>
        <EmptyState
          icon={CloudOff}
          title={t('settings:loadError.title')}
          description={t('settings:loadError.description')}
          action={
            <Button
              onClick={() => {
                void plans.refetch()
                void settings.refetch()
              }}
            >
              {t('common:actions.retry')}
            </Button>
          }
        />
      </Card>
    )
  } else if (!plans.data || !settings.data) {
    body = (
      <div aria-busy className="space-y-4">
        <Skeleton className="h-56 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    )
  } else {
    body = <SettingsForm plans={plans.data} settings={settings.data} />
  }

  return (
    <>
      <PageHeader title={t('nav:settings')} description={t('settings:description')} />
      {body}
    </>
  )
}
