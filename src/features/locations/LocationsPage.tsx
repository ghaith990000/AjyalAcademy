import { CloudOff, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import type { LocationRow } from './api'
import { LocationDialog } from './LocationDialog'
import { useLocations } from './hooks'

export default function LocationsPage() {
  const { t } = useTranslation(['locations', 'nav', 'common'])
  const { data, isPending, isError, refetch } = useLocations()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<LocationRow | null>(null)

  const columns: Column<LocationRow>[] = [
    {
      key: 'name',
      header: t('locations:columns.name'),
      primary: true,
      cell: (location) => (
        // The block follows the page's direction; the name inside keeps its own (a Latin name in an Arabic page).
        <span className="min-w-0">
          <span className="block truncate text-start font-semibold">
            <bdi>{location.name}</bdi>
          </span>
          {location.address && (
            <span className="block truncate text-start text-[13px] font-normal text-ink-muted">
              <bdi>{location.address}</bdi>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('locations:columns.status'),
      cell: (location) =>
        location.active ? (
          <Badge tone="success">{t('locations:status.active')}</Badge>
        ) : (
          <Badge tone="neutral">{t('locations:status.inactive')}</Badge>
        ),
    },
  ]

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-5" aria-hidden />
      {t('locations:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:locations')}
        description={t('locations:description')}
        actions={addButton}
      />
      {isError ? (
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('locations:loadError.title')}
            description={t('locations:loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      ) : (
        <DataList
          caption={t('locations:caption')}
          columns={columns}
          rows={data ?? []}
          getRowKey={(location) => location.id}
          onRowClick={setEditing}
          loading={isPending}
          empty={
            <EmptyState
              icon={MapPin}
              title={t('locations:empty.title')}
              description={t('locations:empty.description')}
              action={addButton}
            />
          }
        />
      )}
      {creating && <LocationDialog onClose={() => setCreating(false)} />}
      {editing && (
        <LocationDialog key={editing.id} location={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
