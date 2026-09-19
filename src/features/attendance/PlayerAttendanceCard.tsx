import { CalendarCheck, CloudOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate, formatTimeRange } from '@/lib/dates'
import { useLanguage } from '@/lib/useLanguage'
import { usePlayerAttendance, usePlayerPresentCount } from './hooks'
import { attendanceRate } from './marks'

/** A player's attendance rate and history on their detail page (cancelled sessions are not counted). */
export function PlayerAttendanceCard({ playerId }: { playerId: string }) {
  const { t } = useTranslation(['attendance', 'common'])
  const { language } = useLanguage()
  const history = usePlayerAttendance(playerId)
  const presentQuery = usePlayerPresentCount(playerId)

  const present = presentQuery.data
  const rate = present === undefined ? null : attendanceRate(present, history.total)

  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <CalendarCheck className="size-5 text-brand-blue" aria-hidden />
        {t('attendance:player.title')}
      </CardTitle>

      {history.isPending ? (
        <Skeleton className="mt-3 h-24 w-full rounded-card" />
      ) : history.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-ink-muted">
          <CloudOff className="size-5" aria-hidden />
          <span>{t('attendance:player.loadError')}</span>
          <Button variant="secondary" onClick={() => void history.refetch()}>
            {t('common:actions.retry')}
          </Button>
        </div>
      ) : history.total === 0 ? (
        <p className="mt-3 text-ink-muted">{t('attendance:player.none')}</p>
      ) : (
        <>
          <div className="mt-3">
            <p className="text-[13px] font-medium text-ink-muted">
              {t('attendance:player.rateLabel')}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-4xl font-extrabold tabular-nums text-brand-blue">
                {rate === null ? '—' : <bdi>{t('attendance:player.rate', { rate })}</bdi>}
              </span>
              {present !== undefined && (
                <span className="text-ink-muted">
                  {t('attendance:player.summary', { present, total: history.total })}
                </span>
              )}
            </p>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {history.rows.map((row) => (
              <li
                key={row.session_id}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    <bdi dir="ltr">{formatDate(row.session_date)}</bdi>
                  </span>
                  <span className="block text-[13px] text-ink-muted">
                    <bdi>{formatTimeRange(row.start_time, row.end_time, language)}</bdi>
                  </span>
                </span>
                <Badge tone={row.status === 'present' ? 'success' : 'danger'}>
                  {t(`attendance:state.${row.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
          {history.hasNextPage && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void history.fetchNextPage()}
                loading={history.isFetchingNextPage}
              >
                {t('attendance:player.showMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
