import { ClipboardList, CloudOff, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import { PageHeader } from '@/components/ui/PageHeader'
import { useActivityRealtime } from '@/features/activity/hooks'
import { ageInYears, formatTimeAgo } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { useNow } from '@/lib/useNow'
import { APPLICATION_STATUSES, type ApplicationRow, type ApplicationStatus } from './api'
import { ApplicationStatusBadge } from './ApplicationStatusBadge'
import { useApplicationsList, usePendingApplicationCount } from './hooks'
import { RegistrationLinkButton } from './RegistrationLinkButton'

const EMPTY_ICONS = { pending: ClipboardList, accepted: UserRoundCheck, rejected: UserRoundX }

/** Registration requests from parents: the ones waiting for a decision first, then what was decided. */
export default function ApplicationsPage() {
  const { t } = useTranslation(['applications', 'common', 'nav', 'players'])
  const { language } = useLanguage()
  const navigate = useNavigate()
  const now = useNow()
  // A request that arrives while the page is open appears without reloading.
  useActivityRealtime()
  const [status, setStatus] = useState<ApplicationStatus>('pending')
  const {
    rows,
    total,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useApplicationsList(status)
  const waiting = usePendingApplicationCount()

  const columns: Column<ApplicationRow>[] = [
    {
      key: 'child',
      header: t('applications:columns.child'),
      primary: true,
      cell: (row) => (
        <span className="min-w-0">
          <span dir="auto" className="block truncate text-start font-semibold">
            {row.full_name}
          </span>
          <span className="block text-[13px] font-normal text-ink-muted">
            {t('players:age', { age: ageInYears(row.date_of_birth) })}
          </span>
        </span>
      ),
    },
    {
      key: 'parent',
      header: t('applications:columns.parent'),
      cell: (row) => (
        <span className="min-w-0">
          <span dir="auto" className="block truncate text-start">
            {row.guardian_name}
          </span>
          <bdi dir="ltr" className="block text-start text-[13px] text-ink-muted">
            {row.phone}
          </bdi>
        </span>
      ),
    },
    {
      key: 'location',
      header: t('applications:columns.location'),
      cell: (row) =>
        row.location_name ? (
          <bdi>{row.location_name}</bdi>
        ) : (
          <span className="text-ink-muted">{t('applications:noLocation')}</span>
        ),
    },
    {
      key: 'sent',
      header: t('applications:columns.sent'),
      cell: (row) => formatTimeAgo(row.created_at, now, language),
    },
    {
      key: 'status',
      header: t('applications:columns.status'),
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ApplicationStatusBadge status={row.status} />
          {(row.existing_player_id !== null || row.same_cpr_pending > 0) && (
            <Badge tone="warning">{t('applications:warning.badge')}</Badge>
          )}
        </span>
      ),
    },
  ]

  const options = APPLICATION_STATUSES.map((value) => ({
    value,
    label:
      value === 'pending' && waiting.data !== undefined && waiting.data > 0
        ? t('applications:filters.pendingCount', { n: waiting.data })
        : t(`applications:filters.${value}`),
  }))

  const EmptyIcon = EMPTY_ICONS[status]

  let body
  if (isError) {
    body = (
      <Card>
        <EmptyState
          icon={CloudOff}
          title={t('applications:loadError.title')}
          description={t('applications:loadError.description')}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
        />
      </Card>
    )
  } else {
    body = (
      <>
        <DataList
          caption={t('applications:list.caption')}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/applications/${row.id}`)}
          loading={isPending}
          empty={
            <EmptyState
              icon={EmptyIcon}
              title={t(`applications:empty.${status}.title`)}
              description={t(`applications:empty.${status}.description`)}
              action={
                status === 'pending' ? <RegistrationLinkButton variant="primary" /> : undefined
              }
            />
          }
        />
        {rows.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-[15px] text-ink-muted">
              {t('applications:list.showing', { shown: rows.length, total })}
            </p>
            {hasNextPage && (
              <Button
                variant="secondary"
                onClick={() => void fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t('applications:list.showMore')}
              </Button>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('applications:title')}
        description={t('applications:description')}
        actions={<RegistrationLinkButton />}
      />
      <div className="mb-4">
        <FilterChips
          label={t('applications:filters.label')}
          options={options}
          value={status}
          onChange={setStatus}
        />
      </div>
      {body}
    </>
  )
}
