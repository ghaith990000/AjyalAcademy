import { CloudOff, Plus, SearchX, UserRoundPlus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox, CheckboxField } from '@/components/ui/Checkbox'
import { DataList, type Column } from '@/components/ui/DataList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/features/auth/useAuth'
import { useCoaches } from '@/features/coaches/hooks'
import { usePlayerStatuses } from '@/features/subscriptions/hooks'
import { SubscriptionStatusBadge } from '@/features/subscriptions/SubscriptionStatusBadge'
import { ageInYears } from '@/lib/dates'
import { DEFAULT_FILTERS, type PlayerFilters, type PlayerRow } from './api'
import { AssignPlayersDialog } from './AssignPlayersDialog'
import { usePlayersBasePath, usePlayersList } from './hooks'
import { PlayerFormDialog } from './PlayerFormDialog'

const SEARCH_DEBOUNCE_MS = 300

/** Keeps a value's previous state until it has been stable for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Stops a click/keypress on an inner control from also activating the row or card behind it. */
const isolate = {
  onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
}

export default function PlayersPage() {
  const { t } = useTranslation(['players', 'nav', 'common', 'subscriptions'])
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const base = usePlayersBasePath()
  const navigate = useNavigate()

  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<PlayerFilters>(DEFAULT_FILTERS)
  const search = useDebounced(searchText, SEARCH_DEBOUNCE_MS)
  const activeFilters: PlayerFilters = { ...filters, search }

  const {
    rows,
    total,
    isPending,
    isError,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = usePlayersList(activeFilters)
  const coaches = useCoaches({ enabled: isAdmin })
  const statuses = usePlayerStatuses(rows.map((row) => row.id))

  const [adding, setAdding] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const filtered = search !== '' || filters.coach !== 'all' || filters.hasCondition
  const shownIds = rows.map((row) => row.id)
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id))

  function changeFilters(next: Partial<PlayerFilters>) {
    setFilters((current) => ({ ...current, ...next }))
    setSelected(new Set()) // a selection only makes sense for the list it was made on
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }
  function toggleAllShown() {
    setSelected(allShownSelected ? new Set() : new Set(shownIds))
  }
  function clearFilters() {
    setSearchText('')
    changeFilters({ coach: 'all', hasCondition: false })
  }

  const selectBox = (player: PlayerRow) => (
    <span {...isolate} className="inline-flex">
      <Checkbox
        checked={selected.has(player.id)}
        onCheckedChange={() => toggle(player.id)}
        aria-label={t('players:list.selectPlayer', { name: player.full_name })}
      />
    </span>
  )

  const columns: Column<PlayerRow>[] = [
    ...(isAdmin
      ? [
          {
            key: 'select',
            mobileHidden: true, // on phones the checkbox sits inside the card title instead
            className: 'w-12',
            header: (
              <span {...isolate} className="inline-flex">
                <Checkbox
                  checked={allShownSelected}
                  onCheckedChange={toggleAllShown}
                  aria-label={t('players:list.selectAll')}
                />
              </span>
            ),
            cell: selectBox,
          } satisfies Column<PlayerRow>,
        ]
      : []),
    {
      key: 'name',
      header: t('players:columns.name'),
      primary: true,
      cell: (player) => (
        <span className="flex items-center gap-3">
          {isAdmin && <span className="md:hidden">{selectBox(player)}</span>}
          <Avatar name={player.full_name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{player.full_name}</span>
            <span
              dir="ltr"
              className="block truncate text-start text-[13px] font-normal text-ink-muted"
            >
              {player.cpr}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'age',
      header: t('players:columns.age'),
      cell: (player) => t('players:age', { age: ageInYears(player.date_of_birth) }),
    },
    {
      key: 'school',
      header: t('players:columns.school'),
      cell: (player) =>
        player.school ?? (
          <span aria-hidden className="text-ink-muted">
            —
          </span>
        ),
    },
    {
      key: 'phone',
      header: t('players:columns.phone'),
      cell: (player) => <bdi dir="ltr">{player.phone}</bdi>,
    },
    ...(isAdmin
      ? [
          {
            key: 'coach',
            header: t('players:columns.coach'),
            cell: (player) =>
              player.coach?.full_name ?? (
                <span className="text-ink-muted">{t('players:unassigned')}</span>
              ),
          } satisfies Column<PlayerRow>,
        ]
      : []),
    {
      key: 'subscription',
      header: t('subscriptions:playerBadge.header'),
      cell: (player) => {
        const status = statuses.data?.[player.id]
        return status ? (
          <SubscriptionStatusBadge status={status} />
        ) : (
          <span className="text-ink-muted">{t('subscriptions:playerBadge.none')}</span>
        )
      },
    },
    {
      key: 'medical',
      header: t('players:columns.medical'),
      cell: (player) =>
        player.has_disease ? (
          <Badge tone="danger">{t('players:medical.condition')}</Badge>
        ) : (
          <span className="text-ink-muted">{t('players:medical.none')}</span>
        ),
    },
  ]

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="size-5" aria-hidden />
      {t('players:add')}
    </Button>
  )

  let body
  if (isError) {
    body = (
      <Card>
        <EmptyState
          icon={CloudOff}
          title={t('players:loadError.title')}
          description={t('players:loadError.description')}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
        />
      </Card>
    )
  } else {
    body = (
      <>
        {isAdmin && rows.length > 0 && (
          <div className="mb-3 md:hidden">
            <CheckboxField
              label={t('players:list.selectAll')}
              checked={allShownSelected}
              onCheckedChange={toggleAllShown}
            />
          </div>
        )}
        <DataList
          caption={t('players:list.caption')}
          columns={columns}
          rows={rows}
          getRowKey={(player) => player.id}
          onRowClick={(player) => navigate(`${base}/${player.id}`)}
          loading={isPending}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title={t('players:noResults.title')}
                description={t('players:noResults.description')}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t('players:filters.clear')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={isAdmin ? Users : UserRoundPlus}
                title={isAdmin ? t('players:empty.title') : t('players:coachEmpty.title')}
                description={
                  isAdmin ? t('players:empty.description') : t('players:coachEmpty.description')
                }
                action={addButton}
              />
            )
          }
        />
        {rows.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-[15px] text-ink-muted">
              {t('players:list.showing', { shown: rows.length, total })}
            </p>
            {hasNextPage && (
              <Button
                variant="secondary"
                onClick={() => void fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t('players:list.showMore')}
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
        title={isAdmin ? t('nav:players') : t('nav:myPlayers')}
        description={isAdmin ? t('players:adminDescription') : t('players:coachDescription')}
        actions={addButton}
      />

      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('players:search.label')} className="sm:col-span-2 lg:col-span-2">
          {(c) => (
            <Input
              {...c}
              type="search"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                setSelected(new Set())
              }}
              placeholder={t('players:search.placeholder')}
              autoComplete="off"
              dir="auto"
            />
          )}
        </Field>
        <Field label={t('players:filters.sort.label')}>
          {(c) => (
            <Select
              {...c}
              value={filters.sort}
              onChange={(event) =>
                changeFilters({ sort: event.target.value as PlayerFilters['sort'] })
              }
            >
              <option value="name">{t('players:filters.sort.name')}</option>
              <option value="newest">{t('players:filters.sort.newest')}</option>
            </Select>
          )}
        </Field>
        {isAdmin && (
          <Field label={t('players:filters.coach.label')}>
            {(c) => (
              <Select
                {...c}
                value={filters.coach}
                onChange={(event) => changeFilters({ coach: event.target.value })}
              >
                <option value="all">{t('players:filters.coach.all')}</option>
                <option value="unassigned">{t('players:filters.coach.unassigned')}</option>
                {coaches.data?.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="flex items-center sm:col-span-2 lg:col-span-4">
          <CheckboxField
            label={t('players:filters.condition')}
            checked={filters.hasCondition}
            onCheckedChange={(checked) => changeFilters({ hasCondition: checked === true })}
          />
          {filtered && (
            <Button variant="ghost" className="ms-auto" onClick={clearFilters}>
              <X className="size-4" aria-hidden />
              {t('players:filters.clear')}
            </Button>
          )}
        </div>
      </Card>

      {isAdmin && selected.size > 0 && (
        <div
          role="region"
          aria-label={t('players:list.selected', { n: selected.size })}
          className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-card bg-brand-navy p-3 text-white shadow-float md:top-2"
        >
          <span className="me-auto ps-1 font-semibold">
            {t('players:list.selected', { n: selected.size })}
          </span>
          <Button variant="accent" onClick={() => setAssigning(true)}>
            {t('players:list.assignSelected')}
          </Button>
          <Button
            variant="ghost"
            className="text-white hover:bg-white/15"
            onClick={() => setSelected(new Set())}
          >
            {t('players:list.clearSelection')}
          </Button>
        </div>
      )}

      <div aria-busy={isFetching && !isPending}>{body}</div>

      {adding && (
        <PlayerFormDialog
          onClose={() => setAdding(false)}
          onSaved={(id) => navigate(`${base}/${id}`)}
        />
      )}
      {assigning && (
        <AssignPlayersDialog
          playerIds={[...selected]}
          onClose={() => setAssigning(false)}
          onDone={() => setSelected(new Set())}
        />
      )}
    </>
  )
}
