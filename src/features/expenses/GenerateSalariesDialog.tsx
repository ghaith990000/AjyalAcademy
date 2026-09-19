import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast-context'
import { useCoaches } from '@/features/coaches/hooks'
import { PeriodSwitcher } from '@/features/reports/PeriodSwitcher'
import { currentPeriod, periodRange, type Period } from '@/lib/reports'
import type { SalaryRun } from './api'
import { useGenerateSalaries } from './hooks'
import { useExpenseError } from './useExpenseError'

interface GenerateSalariesDialogProps {
  /** The month the expenses page is showing — the dialog starts there. */
  initialPeriod: Period
  onClose: () => void
}

/**
 * Adds one salary expense per active coach with a monthly salary, for the chosen month. Safe to repeat: a coach
 * who already has a salary that month is skipped, and the result says how many of each.
 */
export function GenerateSalariesDialog({ initialPeriod, onClose }: GenerateSalariesDialogProps) {
  const { t } = useTranslation(['expenses', 'errors'])
  const toast = useToast()
  const errorMessage = useExpenseError()
  const coaches = useCoaches()
  const generate = useGenerateSalaries()
  const [period, setPeriod] = useState<Period>(
    initialPeriod.kind === 'month' ? initialPeriod : currentPeriod('month'),
  )
  const [result, setResult] = useState<SalaryRun | null>(null)

  const payable = (coaches.data ?? []).filter(
    (coach) => coach.active && coach.monthly_salary_fils > 0,
  )
  const payableFils = payable.reduce((sum, coach) => sum + coach.monthly_salary_fils, 0)

  async function run() {
    try {
      setResult(await generate.mutateAsync(periodRange(period).from))
    } catch (error) {
      toast({ title: t('errors:title'), description: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('expenses:salaries.title')}
      description={t('expenses:salaries.description')}
      footer={
        result ? (
          <Button onClick={onClose}>{t('expenses:salaries.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('expenses:salaries.cancel')}
            </Button>
            <Button
              loading={generate.isPending}
              disabled={coaches.isPending || payable.length === 0}
              onClick={() => void run()}
            >
              {t('expenses:salaries.generate')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div role="status" className="space-y-3">
          <p className="flex items-center gap-2 font-bold text-success">
            <CircleCheck className="size-5 shrink-0" aria-hidden />
            {result.created > 0
              ? t('expenses:salaries.result.created', { n: result.created })
              : t('expenses:salaries.result.nothingNew')}
          </p>
          {result.created > 0 && (
            <p className="text-ink">
              {t('expenses:salaries.result.total')}: <Money fils={result.totalFils} />
            </p>
          )}
          {result.skipped > 0 && (
            <p className="text-ink-muted">
              {t('expenses:salaries.result.skipped', { n: result.skipped })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <PeriodSwitcher period={period} onChange={setPeriod} />
          {coaches.isPending ? (
            <Skeleton className="h-14 w-full rounded-control" />
          ) : coaches.isError ? (
            <p className="text-danger">{t('errors:generic')}</p>
          ) : payable.length === 0 ? (
            <p className="rounded-control bg-warning-50 p-3 text-ink">
              {t('expenses:salaries.noSalaries')}{' '}
              <Link to="/admin/coaches" className="font-semibold text-brand-blue underline">
                {t('expenses:salaries.toCoaches')}
              </Link>
            </p>
          ) : (
            <p className="rounded-control bg-page p-3 text-ink">
              {t('expenses:salaries.preview', { n: payable.length })} <Money fils={payableFils} />
              <span className="mt-1 block text-[13px] text-ink-muted">
                {t('expenses:salaries.previewNote')}
              </span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
