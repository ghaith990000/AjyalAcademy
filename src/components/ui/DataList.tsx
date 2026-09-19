import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './Card'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Mobile card title. Exactly one column should be primary; defaults to the first. */
  primary?: boolean
  /** Hide this column in the mobile card (still shown in the desktop table). */
  mobileHidden?: boolean
  className?: string
}

interface DataListProps<T> {
  columns: readonly Column<T>[]
  rows: readonly T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  /** Shown instead of the list when there are no rows (use <EmptyState/>). */
  empty?: ReactNode
  /** Accessible table name (already translated). */
  caption: string
}

function activateOnKey(event: KeyboardEvent, activate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}

/**
 * Responsive list: a table from `md` up, stacked cards below. Never causes page-level horizontal scroll.
 * Both layouts are rendered; CSS shows the right one.
 */
export function DataList<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  loading = false,
  empty,
  caption,
}: DataListProps<T>) {
  if (loading) {
    return (
      <div aria-busy className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-card" />
        ))}
      </div>
    )
  }

  if (rows.length === 0 && empty) {
    return <Card>{empty}</Card>
  }

  const primary = columns.find((column) => column.primary) ?? columns[0]
  const secondary = columns.filter((column) => column !== primary && !column.mobileHidden)

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
        <table className="w-full text-start">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-brand-blue-50 text-[13px] font-semibold text-ink-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn('px-4 py-3 text-start', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-t border-line',
                  onRowClick && 'cursor-pointer hover:bg-brand-blue-50/60',
                )}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick && (() => onRowClick(row))}
                onKeyDown={onRowClick && ((event) => activateOnKey(event, () => onRowClick(row)))}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3.5 align-middle', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>
            <Card
              className={cn(
                onRowClick && 'cursor-pointer transition-colors active:bg-brand-blue-50',
              )}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick && (() => onRowClick(row))}
              onKeyDown={onRowClick && ((event) => activateOnKey(event, () => onRowClick(row)))}
            >
              {primary && <div className="font-semibold text-ink">{primary.cell(row)}</div>}
              {secondary.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[15px]">
                  {secondary.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[13px] text-ink-muted">{column.header}</dt>
                      <dd className="mt-0.5 break-words">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
