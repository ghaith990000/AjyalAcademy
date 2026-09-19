import { Trans, useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate, formatTimeAgo, formatTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/useLanguage'
import { describeActivity, type ActivityRow, type ActivityTone } from './activity'

const TONES: Record<ActivityTone, string> = {
  blue: 'bg-brand-blue text-white',
  pink: 'bg-brand-pink text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
}

/** The tags the sentences use: `<b>` a name, `<m>` money or a time, `<d>` a date (always left-to-right). */
const TAGS = {
  b: <bdi className="font-semibold text-ink" />,
  m: <bdi />,
  d: <bdi dir="ltr" />,
}

interface ActivityItemProps {
  row: ActivityRow
  now: Date
}

/** One entry: who (avatar with an icon for what they did), a translated sentence, an optional detail, and when. */
export function ActivityItem({ row, now }: ActivityItemProps) {
  const { t } = useTranslation(['activity', 'expenses', 'subscriptions'])
  const { language } = useLanguage()
  const view = describeActivity(row, language, {
    someone: t('activity:fallback.someone'),
    player: t('activity:fallback.player'),
    coach: t('activity:fallback.coach'),
    noCoach: t('activity:fallback.noCoach'),
    // A plan or category added later has no translation yet: show its code rather than nothing.
    plan: (code) =>
      t(`subscriptions:plan.${code}` as 'subscriptions:plan.solo', { defaultValue: code }),
    category: (category) =>
      t(`expenses:category.${category}` as 'expenses:category.other', { defaultValue: category }),
  })
  const Icon = view.icon
  const when = new Date(row.created_at)

  return (
    <li className="flex gap-3 py-3.5">
      <span className="relative shrink-0 self-start">
        <Avatar name={view.actor} size="sm" />
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full ring-2 ring-surface',
            TONES[view.tone],
          )}
        >
          <Icon className="size-3" />
        </span>
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words text-[15px] leading-snug text-ink">
          <Trans
            t={t}
            i18nKey={view.sentence}
            ns="activity"
            values={view.values}
            components={TAGS}
          />
        </p>
        {view.detail && (
          <p className="break-words text-[13px] text-ink-muted">
            <Trans
              t={t}
              i18nKey={view.detail.key}
              ns="activity"
              values={view.detail.values}
              components={{ m: <bdi /> }}
            />
          </p>
        )}
        <p className="text-[13px] text-ink-muted">
          <time
            dateTime={row.created_at}
            title={`${formatDate(when)} ${formatTime(when, language)}`}
          >
            {formatTimeAgo(when, now, language)}
          </time>
        </p>
      </div>
    </li>
  )
}
