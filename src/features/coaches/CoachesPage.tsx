import { CloudOff, Plus, UserCog } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'
import type { Coach } from './api'
import { CreateCoachDialog, EditCoachDialog } from './CoachDialogs'
import { useCoaches } from './hooks'

export default function CoachesPage() {
  const { t } = useTranslation(['coaches', 'nav', 'common'])
  const { language } = useLanguage()
  const { data, isPending, isError, refetch } = useCoaches()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Coach | null>(null)

  const columns: Column<Coach>[] = [
    {
      key: 'name',
      header: t('coaches:columns.name'),
      primary: true,
      cell: (coach) => (
        <span className="flex items-center gap-3">
          <Avatar name={coach.full_name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{coach.full_name}</span>
            <span
              dir="ltr"
              className="block truncate text-start text-[13px] font-normal text-ink-muted"
            >
              {coach.email}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('coaches:columns.phone'),
      cell: (coach) =>
        coach.phone ? (
          <bdi dir="ltr">{coach.phone}</bdi>
        ) : (
          <span aria-hidden className="text-ink-muted">
            —
          </span>
        ),
    },
    {
      key: 'salary',
      header: t('coaches:columns.salary'),
      cell: (coach) => <bdi>{formatBHD(coach.monthly_salary_fils, language)}</bdi>,
    },
    {
      key: 'status',
      header: t('coaches:columns.status'),
      cell: (coach) =>
        coach.active ? (
          <Badge tone="success">{t('coaches:status.active')}</Badge>
        ) : (
          <Badge tone="neutral">{t('coaches:status.inactive')}</Badge>
        ),
    },
  ]

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-5" aria-hidden />
      {t('coaches:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:coaches')}
        description={t('coaches:description')}
        actions={addButton}
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('coaches:loadError.title')}
            description={t('coaches:loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      ) : (
        <DataList
          caption={t('coaches:caption')}
          columns={columns}
          rows={data ?? []}
          getRowKey={(coach) => coach.id}
          onRowClick={setEditing}
          loading={isPending}
          empty={
            <EmptyState
              icon={UserCog}
              title={t('coaches:empty.title')}
              description={t('coaches:empty.description')}
              action={addButton}
            />
          }
        />
      )}

      {creating && <CreateCoachDialog onClose={() => setCreating(false)} />}
      {editing && (
        <EditCoachDialog key={editing.id} coach={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
