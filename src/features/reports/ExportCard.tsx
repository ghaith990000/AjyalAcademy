import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/toast-context'
import { errorKeyOf } from '@/lib/errors'
import { csvFileName, periodRange, type Period } from '@/lib/reports'
import { listExpensesForExport, listPaymentsForExport } from './api'
import { buildExpensesCsv, buildPaymentsCsv, downloadCsv } from './exportCsv'

type Kind = 'payments' | 'expenses'

/** Two downloads for the selected period: every payment and every expense, as UTF-8 CSV that opens in Excel. */
export function ExportCard({ period }: { period: Period }) {
  const { t, i18n } = useTranslation(['reports', 'expenses', 'subscriptions', 'errors'])
  const toast = useToast()
  const [busy, setBusy] = useState<Kind | null>(null)

  async function download(kind: Kind) {
    setBusy(kind)
    try {
      const range = periodRange(period)
      const content =
        kind === 'payments'
          ? buildPaymentsCsv(await listPaymentsForExport(range), {
              headers: [
                t('reports:export.columns.date'),
                t('reports:export.columns.amount'),
                t('reports:export.columns.method'),
                t('reports:export.columns.players'),
                t('reports:export.columns.plan'),
                t('reports:export.columns.note'),
                t('reports:export.columns.receivedBy'),
              ],
              method: (method) => t(`subscriptions:methods.${method}`),
              // A plan added later has no translation yet: show its code rather than nothing.
              plan: (code) =>
                i18n.exists(`subscriptions:plan.${code}`)
                  ? t(`subscriptions:plan.${code}` as 'subscriptions:plan.solo')
                  : code,
            })
          : buildExpensesCsv(await listExpensesForExport(range), {
              headers: [
                t('reports:export.columns.date'),
                t('reports:export.columns.category'),
                t('reports:export.columns.amount'),
                t('reports:export.columns.coach'),
                t('reports:export.columns.description'),
              ],
              category: (category) => t(`expenses:category.${category}`),
            })
      downloadCsv(csvFileName(kind, period), content)
      toast({ title: t('reports:export.done'), tone: 'success' })
    } catch (error) {
      toast({
        title: t('reports:export.failed'),
        description: t(`errors:${errorKeyOf(error)}`),
        tone: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <CardTitle>{t('reports:export.title')}</CardTitle>
        <p className="mt-1 text-ink-muted">{t('reports:export.description')}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          loading={busy === 'payments'}
          disabled={busy !== null}
          onClick={() => void download('payments')}
        >
          <Download className="size-5" aria-hidden />
          {t('reports:export.payments')}
        </Button>
        <Button
          variant="secondary"
          loading={busy === 'expenses'}
          disabled={busy !== null}
          onClick={() => void download('expenses')}
        >
          <Download className="size-5" aria-hidden />
          {t('reports:export.expenses')}
        </Button>
      </div>
    </Card>
  )
}
