import { CloudOff, Plus, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { PageHeader } from '@/components/ui/PageHeader'
import { LocationSelect } from '@/features/locations/LocationField'
import { PeriodSwitcher } from '@/features/reports/PeriodSwitcher'
import { useExpensesByCategory } from '@/features/reports/hooks'
import { formatDate, formatMonthYear, todayISO } from '@/lib/dates'
import { currentPeriod, periodRange, type Period } from '@/lib/reports'
import { useLanguage } from '@/lib/useLanguage'
import type { ExpenseRow } from './api'
import type { ExpenseCategory } from './categories'
import { CategoryChips } from './CategoryChips'
import { DeleteExpenseDialog } from './DeleteExpenseDialog'
import { ExpenseFormDialog } from './ExpenseFormDialog'
import { GenerateSalariesDialog } from './GenerateSalariesDialog'
import { useExpensesList } from './hooks'

export default function ExpensesPage() {
  const { t } = useTranslation(['expenses', 'nav', 'common', 'locations'])
  const { language } = useLanguage()
  const [period, setPeriod] = useState<Period>(() => currentPeriod('month'))
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all')
  const [locationId, setLocationId] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null)

  const range = periodRange(period)
  const monthName =
    period.kind === 'month' ? formatMonthYear(period.year, period.month, language) : ''
  const list = useExpensesList({ range, category, locationId })
  const totals = useExpensesByCategory(range, locationId || undefined)
  const monthTotal = totals.data?.reduce((sum, entry) => sum + entry.totalFils, 0)
  const categoryTotal =
    category === 'all'
      ? undefined
      : (totals.data?.find((entry) => entry.category === category)?.totalFils ?? 0)
  // A new expense cannot be dated in the future: today for this month, the month's last day for a past one.
  const defaultDate = range.to > todayISO() ? todayISO() : range.to

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'expense',
      header: t('expenses:columns.expense'),
      primary: true,
      cell: (expense) => (
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {t(`expenses:category.${expense.category}`)}
            {expense.coach && <> · {expense.coach.full_name}</>}
          </span>
          <span className="block truncate text-[13px] font-normal text-ink-muted">
            <bdi>{expense.location?.name ?? t('expenses:academyWide')}</bdi>
            {expense.description && (
              <>
                {' · '}
                <bdi>{expense.description}</bdi>
              </>
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'date',
      header: t('expenses:columns.date'),
      cell: (expense) => <bdi dir="ltr">{formatDate(expense.expense_date)}</bdi>,
    },
    {
      key: 'amount',
      header: t('expenses:columns.amount'),
      cell: (expense) => (
        <span className="font-bold text-ink">
          <Money fils={expense.amount_fils} />
        </span>
      ),
    },
  ]

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-5" aria-hidden />
      {t('expenses:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:expenses')}
        description={t('expenses:description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setGenerating(true)}>
              <Wallet className="size-5" aria-hidden />
              {t('expenses:salaries.open')}
            </Button>
            {addButton}
          </>
        }
      />

      <div className="space-y-4">
        <PeriodSwitcher period={period} onChange={setPeriod} />

        <Card className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-[13px] font-medium text-ink-muted">
              {t('expenses:totals.month', { month: monthName })}
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-ink">
              {monthTotal === undefined ? '—' : <Money fils={monthTotal} />}
            </p>
          </div>
          {category !== 'all' && (
            <div>
              <p className="text-[13px] font-medium text-ink-muted">
                {t(`expenses:category.${category}`)}
              </p>
              <p className="text-xl font-bold tabular-nums text-ink">
                {categoryTotal === undefined ? '—' : <Money fils={categoryTotal} />}
              </p>
            </div>
          )}
        </Card>

        <CategoryChips value={category} onChange={setCategory} />

        <Card>
          <Field label={t('locations:filter.label')}>
            {(c) => (
              <LocationSelect
                {...c}
                value={locationId}
                currentId={locationId}
                emptyLabel={t('locations:select.all')}
                onChange={(event) => setLocationId(event.target.value)}
              />
            )}
          </Field>
        </Card>

        {list.isError ? (
          <Card>
            <EmptyState
              icon={CloudOff}
              title={t('expenses:loadError.title')}
              description={t('expenses:loadError.description')}
              action={
                <Button onClick={() => void list.refetch()}>{t('common:actions.retry')}</Button>
              }
            />
          </Card>
        ) : (
          <>
            <DataList
              caption={t('expenses:caption')}
              columns={columns}
              rows={list.rows}
              getRowKey={(expense) => expense.id}
              onRowClick={setEditing}
              loading={list.isPending}
              empty={
                <EmptyState
                  icon={Receipt}
                  title={
                    category === 'all'
                      ? t('expenses:empty.title', { month: monthName })
                      : t('expenses:empty.titleCategory', {
                          category: t(`expenses:category.${category}`),
                          month: monthName,
                        })
                  }
                  description={t('expenses:empty.description')}
                  action={addButton}
                />
              }
            />
            {list.rows.length > 0 && (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-[13px] text-ink-muted">
                  {t('expenses:list.showing', { shown: list.rows.length, total: list.total })}
                </p>
                {list.hasNextPage && (
                  <Button
                    variant="secondary"
                    onClick={() => void list.fetchNextPage()}
                    loading={list.isFetchingNextPage}
                  >
                    {t('expenses:list.showMore')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {creating && (
        <ExpenseFormDialog defaultDate={defaultDate} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ExpenseFormDialog
          key={editing.id}
          expense={editing}
          onClose={() => setEditing(null)}
          onDelete={() => setDeleting(editing)}
        />
      )}
      {deleting && (
        <DeleteExpenseDialog
          expense={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            setEditing(null)
          }}
        />
      )}
      {generating && (
        <GenerateSalariesDialog initialPeriod={period} onClose={() => setGenerating(false)} />
      )}
    </>
  )
}
