import { Bell, CloudOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNow } from '@/lib/useNow'
import { ACTIVITY_FILTERS, COACH_ACTIVITY_FILTERS, type ActivityFilter } from './activity'
import { ActivityItem } from './ActivityItem'
import { useActivityFeed } from './hooks'

interface ActivityFeedProps {
  /** An admin sees everyone's activity, a coach only their own (the database enforces it). */
  role: 'admin' | 'coach'
  /** Whether the live connection is up — shown as a "Live" badge. */
  live?: boolean
}

export function ActivityFeed({ role, live = false }: ActivityFeedProps) {
  const { t } = useTranslation(['activity', 'common'])
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const feed = useActivityFeed(filter)
  const now = useNow()
  const filters = role === 'admin' ? ACTIVITY_FILTERS : COACH_ACTIVITY_FILTERS

  let body
  if (feed.isPending) {
    body = (
      <div aria-busy className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-control" />
        ))}
      </div>
    )
  } else if (feed.isError && feed.rows.length === 0) {
    body = (
      <EmptyState
        icon={CloudOff}
        title={t('activity:loadError.title')}
        description={t('activity:loadError.description')}
        action={<Button onClick={() => void feed.refetch()}>{t('common:actions.retry')}</Button>}
      />
    )
  } else if (feed.rows.length === 0) {
    body =
      filter === 'all' ? (
        <EmptyState
          icon={Bell}
          title={t('activity:empty.title')}
          description={t('activity:empty.description')}
        />
      ) : (
        <EmptyState
          icon={Bell}
          title={t('activity:empty.filteredTitle')}
          description={t('activity:empty.filteredDescription')}
          action={
            <Button variant="secondary" onClick={() => setFilter('all')}>
              {t('activity:filters.all')}
            </Button>
          }
        />
      )
  } else {
    body = (
      <>
        <ul
          aria-busy={feed.isFetching && !feed.isFetchingNextPage}
          className="divide-y divide-line"
        >
          {feed.rows.map((row) => (
            <ActivityItem key={row.id} row={row} now={now} />
          ))}
        </ul>
        {feed.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              onClick={() => void feed.fetchNextPage()}
              loading={feed.isFetchingNextPage}
            >
              {t('activity:showMore')}
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <Card className="min-w-0 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t(`activity:title.${role}`)}</CardTitle>
          {live && <Badge tone="success">{t('activity:live')}</Badge>}
        </div>
        <p className="text-ink-muted">{t(`activity:description.${role}`)}</p>
      </div>
      <FilterChips
        label={t('activity:filters.label')}
        options={filters.map((value) => ({ value, label: t(`activity:filters.${value}`) }))}
        value={filter}
        onChange={setFilter}
        layout="scroll"
      />
      {body}
    </Card>
  )
}
