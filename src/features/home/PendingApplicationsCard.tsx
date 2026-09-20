import { ChevronRight, ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { usePendingApplicationCount } from '@/features/applications/hooks'

/** Admin home: registration requests from parents waiting for a decision. Nothing waiting, nothing shown. */
export function PendingApplicationsCard() {
  const { t } = useTranslation('home')
  const pending = usePendingApplicationCount()
  const waiting = pending.data ?? 0
  if (waiting <= 0) return null

  return (
    <Link
      to="/admin/applications"
      className="flex min-h-16 items-center gap-3 rounded-card border border-brand-pink/30 bg-brand-pink-50 p-4 shadow-card transition-colors hover:bg-brand-pink-50/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-pink text-white">
        <ClipboardList className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{t('applications.title')}</span>
        <span className="block text-[15px] text-ink-muted">
          {t('applications.waiting', { n: waiting })}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-pink-700">
        <span className="hidden sm:inline">{t('applications.review')}</span>
        <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
      </span>
    </Link>
  )
}
