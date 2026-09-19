import { CloudOff, Percent, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate } from '@/lib/dates'
import { formatDiscountValue } from '@/lib/discounts'
import { useLanguage } from '@/lib/useLanguage'
import type { DiscountWithUses } from './api'
import { DiscountDialog } from './DiscountDialog'
import { useDiscounts } from './hooks'

export default function DiscountsPage() {
  const { t } = useTranslation(['discounts', 'nav', 'common'])
  const { language } = useLanguage()
  const { data, isPending, isError, refetch } = useDiscounts()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DiscountWithUses | null>(null)

  function validity(discount: DiscountWithUses): string {
    const { valid_from: from, valid_to: to } = discount
    if (from && to)
      return t('discounts:validity.range', { from: formatDate(from), to: formatDate(to) })
    if (from) return t('discounts:validity.from', { date: formatDate(from) })
    if (to) return t('discounts:validity.until', { date: formatDate(to) })
    return t('discounts:validity.always')
  }

  const columns: Column<DiscountWithUses>[] = [
    {
      key: 'name',
      header: t('discounts:columns.name'),
      primary: true,
      cell: (discount) => (
        <span className="min-w-0">
          <span className="block truncate font-semibold">{discount.name}</span>
          <span
            dir="ltr"
            className="block truncate text-start text-[13px] font-normal text-ink-muted"
          >
            {discount.code}
          </span>
        </span>
      ),
    },
    {
      key: 'value',
      header: t('discounts:columns.value'),
      cell: (discount) => <bdi>{formatDiscountValue(discount.type, discount.value, language)}</bdi>,
    },
    { key: 'validity', header: t('discounts:columns.validity'), cell: validity },
    {
      key: 'uses',
      header: t('discounts:columns.uses'),
      cell: (discount) =>
        discount.max_uses
          ? t('discounts:uses.limited', { used: discount.uses, max: discount.max_uses })
          : t('discounts:uses.unlimited', { used: discount.uses }),
    },
    {
      key: 'status',
      header: t('discounts:columns.status'),
      cell: (discount) =>
        discount.active ? (
          <Badge tone="success">{t('discounts:status.active')}</Badge>
        ) : (
          <Badge tone="neutral">{t('discounts:status.inactive')}</Badge>
        ),
    },
  ]

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-5" aria-hidden />
      {t('discounts:add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav:discounts')}
        description={t('discounts:description')}
        actions={addButton}
      />
      {isError ? (
        <Card>
          <EmptyState
            icon={CloudOff}
            title={t('discounts:loadError.title')}
            description={t('discounts:loadError.description')}
            action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
          />
        </Card>
      ) : (
        <DataList
          caption={t('discounts:caption')}
          columns={columns}
          rows={data ?? []}
          getRowKey={(discount) => discount.id}
          onRowClick={setEditing}
          loading={isPending}
          empty={
            <EmptyState
              icon={Percent}
              title={t('discounts:empty.title')}
              description={t('discounts:empty.description')}
              action={addButton}
            />
          }
        />
      )}
      {creating && <DiscountDialog onClose={() => setCreating(false)} />}
      {editing && (
        <DiscountDialog key={editing.id} discount={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
