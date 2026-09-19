import { CloudOff, CreditCard, Plus, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Money } from '@/components/ui/Money'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/features/auth/useAuth'
import { formatDate } from '@/lib/dates'
import { SUBSCRIPTION_STATUSES } from '@/lib/subscription-status'
import { cn } from '@/lib/utils'
import { DEFAULT_SUBSCRIPTION_FILTERS, type SubscriptionFilters, type SubscriptionRow } from './api'
import { useSubscriptionsBasePath, useSubscriptionsList } from './hooks'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function SubscriptionsPage() {
  const { t } = useTranslation(['subscriptions', 'nav', 'common'])
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const base = useSubscriptionsBasePath()
  const navigate = useNavigate()

  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<SubscriptionFilters['status']>('all')
  const search = useDebounced(searchText, 300)
  const filters: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, status, search }
  const {
    rows,
    total,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useSubscriptionsList(filters)
  const filtered = status !== 'all' || search !== ''

  function clearFilters() {
    setSearchText('')
    setStatus('all')
  }

  const columns: Column<SubscriptionRow>[] = [
    {
      key: 'players',
      header: t('subscriptions:columns.players'),
      primary: true,
      cell: (row) => {
        const visible = row.player_names ? row.player_names.split(', ').length : 0
        const hidden = row.player_count - visible
        return (
          <span className="min-w-0">
            <span className="block break-words font-semibold">{row.player_names ?? '—'}</span>
            {hidden > 0 && (
              <span className="block text-[13px] font-normal text-ink-muted">
                {t('subscriptions:hiddenPlayers', { n: hidden })}
              </span>
            )}
            <span className="block text-[13px] font-normal text-ink-muted">
              {t(`subscriptions:plan.${row.plan_code as 'solo' | 'duo' | 'trio' | 'quad'}`)}
            </span>
          </span>
        )
      },
    },
    {
      key: 'period',
      header: t('subscriptions:columns.period'),
      cell: (row) => (
        <bdi dir="ltr">
          {formatDate(row.start_date)} – {formatDate(row.end_date)}
        </bdi>
      ),
    },
    {
      key: 'total',
      header: t('subscriptions:columns.total'),
      cell: (row) => <Money fils={row.total_fils} />,
    },
    {
      key: 'paid',
      header: t('subscriptions:columns.paid'),
      cell: (row) => <Money fils={row.paid_fils} />,
    },
    {
      key: 'balance',
      header: t('subscriptions:columns.balance'),
      cell: (row) => (
        <span
          className={cn(
            row.balance_fils > 0 && row.status !== 'cancelled'
              ? 'font-semibold text-danger'
              : 'text-ink-muted',
          )}
        >
          <Money fils={row.balance_fils} />
        </span>
      ),
    },
    {
      key: 'status',
      header: t('subscriptions:columns.status'),
      cell: (row) => <SubscriptionStatusBadge status={row.status} />,
    },
  ]

  const addButton = (
    <Button onClick={() => navigate(`${base}/new`)}>
      <Plus className="size-5" aria-hidden />
      {t('subscriptions:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:subscriptions')}
        description={
          isAdmin ? t('subscriptions:adminDescription') : t('subscriptions:coachDescription')
        }
        actions={addButton}
      />

      <Card className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={t('subscriptions:search.label')}>
          {(c) => (
            <Input
              {...c}
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('subscriptions:search.placeholder')}
              autoComplete="off"
              dir="auto"
            />
          )}
        </Field>
        <Field label={t('subscriptions:filters.status.label')}>
          {(c) => (
            <Select
              {...c}
              value={status}
              onChange={(event) => setStatus(event.target.value as SubscriptionFilters['status'])}
            >
              <option value="all">{t('subscriptions:filters.status.all')}</option>
              {SUBSCRIPTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`subscriptions:status.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {filtered && (
          <div className="sm:col-span-2">
            <Button variant="ghost" onClick={clearFilters}>
              {t('subscriptions:filters.clear')}
            </Button>
          </div>
        )}
      </Card>

      {isError ? (
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('subscriptions:loadError.title')}
            description={t('subscriptions:loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      ) : (
        <>
          <DataList
            caption={t('subscriptions:list.caption')}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(`${base}/${row.id}`)}
            loading={isPending}
            empty={
              filtered ? (
                <EmptyState
                  icon={SearchX}
                  title={t('subscriptions:noResults.title')}
                  description={t('subscriptions:noResults.description')}
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      {t('subscriptions:filters.clear')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title={t('subscriptions:empty.title')}
                  description={t('subscriptions:empty.description')}
                  action={addButton}
                />
              )
            }
          />
          {rows.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-[15px] text-ink-muted">
                {t('subscriptions:list.showing', { shown: rows.length, total })}
              </p>
              {hasNextPage && (
                <Button
                  variant="secondary"
                  onClick={() => void fetchNextPage()}
                  loading={isFetchingNextPage}
                >
                  {t('subscriptions:list.showMore')}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
