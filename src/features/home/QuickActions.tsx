import { CalendarPlus, CreditCard, UserPlus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerFormDialog } from '@/features/players/PlayerFormDialog'
import { SessionFormDialog } from '@/features/sessions/SessionFormDialog'

const TILE =
  'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-card border border-line bg-surface p-2 text-center text-[13px] font-semibold leading-tight text-ink shadow-card transition-colors hover:bg-brand-blue-50'

function Tile({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <span className="flex size-9 items-center justify-center rounded-control bg-brand-blue-50 text-brand-blue">
        <Icon className="size-5" aria-hidden />
      </span>
      {label}
    </>
  )
}

/** The three things staff do most, within thumb reach. Adding a player and scheduling open in place. */
export function QuickActions({ base }: { base: '/admin' | '/coach' }) {
  const { t } = useTranslation('home')
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'player' | 'session' | null>(null)

  return (
    <>
      <nav aria-label={t('quick.label')} className="grid grid-cols-3 gap-3">
        <button type="button" className={TILE} onClick={() => setDialog('player')}>
          <Tile icon={UserPlus} label={t('quick.addPlayer')} />
        </button>
        <Link to={`${base}/subscriptions/new`} className={TILE}>
          <Tile icon={CreditCard} label={t('quick.newSubscription')} />
        </Link>
        <button type="button" className={TILE} onClick={() => setDialog('session')}>
          <Tile icon={CalendarPlus} label={t('quick.scheduleSession')} />
        </button>
      </nav>
      {dialog === 'player' && (
        <PlayerFormDialog
          onClose={() => setDialog(null)}
          onSaved={(id) => navigate(`${base}/players/${id}`)}
        />
      )}
      {dialog === 'session' && <SessionFormDialog onClose={() => setDialog(null)} />}
    </>
  )
}
