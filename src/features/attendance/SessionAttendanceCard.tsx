import { CloudOff, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/lib/useLanguage'
import { useSessionAttendance } from './hooks'

/** Who attended a session (read-only): the saved marks, present first counted in the summary. */
export function SessionAttendanceCard({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation(['attendance', 'common'])
  const { language } = useLanguage()
  const { data, isPending, isError, refetch } = useSessionAttendance(sessionId)

  // A mark whose player is hidden from the caller (now another coach's) has no name to show.
  const collator = new Intl.Collator(language)
  const rows = (data ?? [])
    .filter((row) => row.player !== null)
    .sort((a, b) => collator.compare(a.player!.full_name, b.player!.full_name))
  const present = rows.filter((row) => row.status === 'present').length

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-brand-blue" aria-hidden />
          {t('attendance:session.title')}
        </CardTitle>
        {rows.length > 0 && (
          <p className="font-semibold text-ink-muted">
            {t('attendance:session.summary', { present, total: rows.length })}
          </p>
        )}
      </div>

      {isPending ? (
        <Skeleton className="mt-3 h-24 w-full rounded-card" />
      ) : isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-ink-muted">
          <CloudOff className="size-5" aria-hidden />
          <span>{t('attendance:session.loadError')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common:actions.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-ink-muted">{t('attendance:session.notTaken')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.player_id}
              className="flex min-h-12 items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 break-words font-medium" dir="auto">
                {row.player!.full_name}
              </span>
              <Badge tone={row.status === 'present' ? 'success' : 'danger'}>
                {t(`attendance:state.${row.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
