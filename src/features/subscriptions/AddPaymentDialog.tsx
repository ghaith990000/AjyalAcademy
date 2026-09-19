import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Money } from '@/components/ui/Money'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import { isValidISODate, todayISO } from '@/lib/dates'
import { parseBD, toBD } from '@/lib/money'
import type { PaymentMethod, SubscriptionRow } from './api'
import { useRecordPayment } from './hooks'
import { useSubscriptionError } from './useSubscriptionError'

const METHODS: PaymentMethod[] = ['cash', 'benefit', 'bank_transfer', 'other']
const FORM_ID = 'payment-form'

// Messages are `subscriptions` namespace keys, translated where they are rendered.
function paymentSchema(balanceFils: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((value) => (parseBD(value) ?? 0) >= 1, 'payment.amount.invalid')
      .refine((value) => (parseBD(value) ?? 0) <= balanceFils, 'payment.amount.tooHigh'),
    method: z.enum(['cash', 'benefit', 'bank_transfer', 'other']),
    paid_at: z
      .string()
      .refine((value) => isValidISODate(value) && value <= todayISO(), 'payment.date.future'),
    note: z.string().trim().max(300),
  })
}
type PaymentValues = z.infer<ReturnType<typeof paymentSchema>>

interface AddPaymentDialogProps {
  subscription: SubscriptionRow
  onClose: () => void
}

/** Record money received; the amount defaults to the whole balance and can never exceed it. */
export function AddPaymentDialog({ subscription, onClose }: AddPaymentDialogProps) {
  const { t } = useTranslation(['subscriptions', 'common', 'errors'])
  const toast = useToast()
  const record = useRecordPayment()
  const errorMessage = useSubscriptionError()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema(subscription.balance_fils)),
    defaultValues: {
      amount: String(toBD(subscription.balance_fils)),
      method: 'cash',
      paid_at: todayISO(),
      note: '',
    },
  })
  const message = (key?: string) =>
    key ? t(`subscriptions:${key}` as ParseKeys<'subscriptions'>) : undefined

  async function onSubmit(values: PaymentValues) {
    try {
      await record.mutateAsync({
        p_subscription_id: subscription.id,
        p_amount_fils: parseBD(values.amount) ?? 0,
        p_method: values.method,
        p_paid_at: values.paid_at,
        ...(values.note ? { p_note: values.note } : {}),
      })
      toast({ title: t('subscriptions:payment.toast.recorded'), tone: 'success' })
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('subscriptions:payment.title')}
      description={t('subscriptions:payment.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {t('subscriptions:payment.submit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('subscriptions:payment.amount.label')}
          hint={
            <>
              {t('subscriptions:detail.breakdown.balance')}:{' '}
              <Money fils={subscription.balance_fils} />
            </>
          }
          required
          error={message(errors.amount?.message)}
        >
          {(c) => <Input {...c} {...register('amount')} inputMode="decimal" ltr />}
        </Field>
        <Field label={t('subscriptions:payment.method')} required>
          {(c) => (
            <Select {...c} {...register('method')}>
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`subscriptions:methods.${method}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('subscriptions:payment.date.label')}
          required
          error={message(errors.paid_at?.message)}
        >
          {(c) => <Input {...c} {...register('paid_at')} type="date" max={todayISO()} ltr />}
        </Field>
        <Field label={t('subscriptions:payment.note')}>
          {(c) => <Textarea {...c} {...register('note')} rows={2} />}
        </Field>
      </form>
    </Dialog>
  )
}
