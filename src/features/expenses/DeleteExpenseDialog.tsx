import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Money } from '@/components/ui/Money'
import { useToast } from '@/components/ui/toast-context'
import { formatDate } from '@/lib/dates'
import type { ExpenseRow } from './api'
import { useDeleteExpense } from './hooks'
import { useExpenseError } from './useExpenseError'

interface DeleteExpenseDialogProps {
  expense: ExpenseRow
  onClose: () => void
  /** Called after the expense is gone (the page also closes the edit dialog behind this one). */
  onDeleted: () => void
}

/** Deleting removes the expense from every report; the deletion itself is kept in the activity log. */
export function DeleteExpenseDialog({ expense, onClose, onDeleted }: DeleteExpenseDialogProps) {
  const { t } = useTranslation(['expenses', 'errors'])
  const toast = useToast()
  const remove = useDeleteExpense()
  const errorMessage = useExpenseError()

  async function confirm() {
    try {
      await remove.mutateAsync(expense.id)
      toast({ title: t('expenses:toast.deleted'), tone: 'success' })
      onDeleted()
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('expenses:deleteDialog.title')}
      description={t('expenses:deleteDialog.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('expenses:deleteDialog.keep')}
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            {t('expenses:deleteDialog.confirm')}
          </Button>
        </>
      }
    >
      <p className="rounded-control bg-page p-3 font-semibold text-ink">
        {t(`expenses:category.${expense.category}`)} · <Money fils={expense.amount_fils} /> ·{' '}
        <bdi dir="ltr">{formatDate(expense.expense_date)}</bdi>
      </p>
    </Dialog>
  )
}
