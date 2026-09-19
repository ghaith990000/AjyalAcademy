import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SwitchField } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/toast-context'
import { percentInputValue } from '@/lib/discounts'
import { errorKeyOf } from '@/lib/errors'
import { toBD } from '@/lib/money'
import { DuplicateCodeError, type Discount } from './api'
import { useCreateDiscount, useUpdateDiscount } from './hooks'
import { discountSchema, toDiscountInput, type DiscountFormValues } from './schema'

const FORM_ID = 'discount-form'

interface DiscountDialogProps {
  /** Present = edit this discount; absent = add a new one. */
  discount?: Discount
  onClose: () => void
}

export function DiscountDialog({ discount, onClose }: DiscountDialogProps) {
  const { t } = useTranslation(['discounts', 'common', 'errors'])
  const toast = useToast()
  const create = useCreateDiscount()
  const update = useUpdateDiscount()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: discount?.name ?? '',
      code: discount?.code ?? '',
      type: discount?.type ?? 'percent',
      value: discount
        ? discount.type === 'percent'
          ? percentInputValue(discount.value)
          : String(toBD(discount.value))
        : '',
      valid_from: discount?.valid_from ?? '',
      valid_to: discount?.valid_to ?? '',
      max_uses: discount?.max_uses ? String(discount.max_uses) : '',
      active: discount?.active ?? true,
    },
  })
  const type = useWatch({ control, name: 'type' })
  const message = (key?: string) =>
    key ? t(`discounts:${key}` as ParseKeys<'discounts'>) : undefined

  async function onSubmit(values: DiscountFormValues) {
    const input = toDiscountInput(values)
    try {
      if (discount) await update.mutateAsync({ id: discount.id, input })
      else await create.mutateAsync(input)
      toast({
        title: t(discount ? 'discounts:toast.updated' : 'discounts:toast.created'),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      if (error instanceof DuplicateCodeError) {
        setError('code', { message: 'form.code.taken' })
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
      title={discount ? t('discounts:form.editTitle') : t('discounts:form.createTitle')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {discount ? t('discounts:form.submitEdit') : t('discounts:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label={t('discounts:form.name.label')}
          required
          error={message(errors.name?.message)}
        >
          {(c) => <Input {...c} {...register('name')} dir="auto" autoComplete="off" />}
        </Field>
        <Field
          label={t('discounts:form.code.label')}
          hint={t('discounts:form.code.hint')}
          required
          error={message(errors.code?.message)}
        >
          {(c) => (
            <Input
              {...c}
              {...register('code')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              ltr
            />
          )}
        </Field>
        <Field label={t('discounts:form.type.label')} required>
          {(c) => (
            <Select {...c} {...register('type')}>
              <option value="percent">{t('discounts:form.type.percent')}</option>
              <option value="fixed">{t('discounts:form.type.fixed')}</option>
            </Select>
          )}
        </Field>
        <Field
          label={
            type === 'percent'
              ? t('discounts:form.value.percentLabel')
              : t('discounts:form.value.fixedLabel')
          }
          required
          error={message(errors.value?.message)}
        >
          {(c) => <Input {...c} {...register('value')} inputMode="decimal" ltr />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('discounts:form.validFrom.label')}
            error={message(errors.valid_from?.message)}
          >
            {(c) => <Input {...c} {...register('valid_from')} type="date" ltr />}
          </Field>
          <Field
            label={t('discounts:form.validTo.label')}
            error={message(errors.valid_to?.message)}
          >
            {(c) => <Input {...c} {...register('valid_to')} type="date" ltr />}
          </Field>
        </div>
        <Field
          label={t('discounts:form.maxUses.label')}
          hint={t('discounts:form.maxUses.hint')}
          error={message(errors.max_uses?.message)}
        >
          {(c) => <Input {...c} {...register('max_uses')} inputMode="numeric" ltr />}
        </Field>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField
              label={t('discounts:form.active.label')}
              hint={t('discounts:form.active.hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </form>
    </Dialog>
  )
}
