import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { Trash2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import { useCoaches } from '@/features/coaches/hooks'
import { todayISO } from '@/lib/dates'
import { toBD } from '@/lib/money'
import type { ExpenseRow } from './api'
import { EXPENSE_CATEGORIES } from './categories'
import { useCreateExpense, useUpdateExpense } from './hooks'
import { expenseSchema, toExpenseInput, type ExpenseFormValues } from './schema'
import { useExpenseError } from './useExpenseError'

const FORM_ID = 'expense-form'

interface ExpenseFormDialogProps {
  /** Present = edit this expense; absent = add a new one. */
  expense?: ExpenseRow
  /** Month being viewed: a new expense starts on today, or on that month's last day when it is a past month. */
  defaultDate?: string
  onClose: () => void
  /** Edit mode only: the person asked to delete (the page opens the confirmation). */
  onDelete?: () => void
}

export function ExpenseFormDialog({
  expense,
  defaultDate,
  onClose,
  onDelete,
}: ExpenseFormDialogProps) {
  const { t } = useTranslation(['expenses', 'common', 'errors'])
  const toast = useToast()
  const errorMessage = useExpenseError()
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const coaches = useCoaches()

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense?.category ?? 'other',
      amount: expense ? String(toBD(expense.amount_fils)) : '',
      expense_date: expense?.expense_date ?? defaultDate ?? todayISO(),
      coach_id: expense?.coach_id ?? '',
      description: expense?.description ?? '',
    },
  })
  const category = useWatch({ control, name: 'category' })
  const isSalary = category === 'coach_salary'
  const message = (key?: string) =>
    key ? t(`expenses:${key}` as ParseKeys<'expenses'>) : undefined

  /** Picking a coach for a salary fills in their monthly salary, unless an amount was already typed. */
  function prefillSalary(coachId: string) {
    if (getValues('amount') !== '') return
    const coach = coaches.data?.find((candidate) => candidate.id === coachId)
    if (coach && coach.monthly_salary_fils > 0) {
      // Revalidate too: an earlier "enter an amount" error must not outlive the value that fixes it.
      setValue('amount', String(toBD(coach.monthly_salary_fils)), { shouldValidate: true })
    }
  }

  async function onSubmit(values: ExpenseFormValues) {
    const input = toExpenseInput(values)
    try {
      if (expense) await update.mutateAsync({ id: expense.id, input })
      else await create.mutateAsync(input)
      toast({
        title: t(expense ? 'expenses:toast.updated' : 'expenses:toast.created'),
        tone: 'success',
      })
      onClose()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={expense ? t('expenses:form.editTitle') : t('expenses:form.createTitle')}
      fullOnMobile
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {expense ? t('expenses:form.submitEdit') : t('expenses:form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={t('expenses:form.category.label')} required>
          {(c) => (
            <Select {...c} {...register('category')}>
              {EXPENSE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(`expenses:category.${key}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {isSalary && (
          <Field
            label={t('expenses:form.coach.label')}
            required
            error={message(errors.coach_id?.message)}
          >
            {(c) => (
              <Select
                {...c}
                {...register('coach_id', {
                  onChange: (event) => prefillSalary(event.target.value),
                })}
              >
                <option value="">{t('expenses:form.coach.placeholder')}</option>
                {(coaches.data ?? []).map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.active
                      ? coach.full_name
                      : t('expenses:form.coach.inactive', { name: coach.full_name })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field
          label={t('expenses:form.amount.label')}
          hint={t('expenses:form.amount.hint')}
          required
          error={message(errors.amount?.message)}
        >
          {(c) => (
            <Input {...c} {...register('amount')} inputMode="decimal" ltr autoComplete="off" />
          )}
        </Field>

        <Field
          label={t('expenses:form.date.label')}
          required
          error={message(errors.expense_date?.message)}
        >
          {(c) => <Input {...c} {...register('expense_date')} type="date" max={todayISO()} ltr />}
        </Field>

        <Field
          label={t('expenses:form.description.label')}
          error={message(errors.description?.message)}
        >
          {(c) => <Textarea {...c} {...register('description')} rows={3} dir="auto" />}
        </Field>

        {expense && onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="text-danger hover:bg-danger-50"
            onClick={onDelete}
          >
            <Trash2 className="size-5" aria-hidden />
            {t('expenses:form.delete')}
          </Button>
        )}
      </form>
    </Dialog>
  )
}
