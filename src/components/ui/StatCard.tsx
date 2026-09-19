import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './Card'

const TONES = {
  blue: 'bg-brand-blue-50 text-brand-blue',
  pink: 'bg-brand-pink-50 text-brand-pink-700',
  success: 'bg-success-50 text-success',
  warning: 'bg-warning-50 text-warning',
} as const

interface StatCardProps {
  label: string
  /** Number/text. Wrap money in <bdi> so RTL doesn't reorder the currency label. */
  value: ReactNode
  icon: LucideIcon
  tone?: keyof typeof TONES
  hint?: ReactNode
  /**
   * Icon beside the label with the value underneath, instead of a big icon block. About half the height, and
   * a value such as "540.000 BD" fits a half-width card on a phone — use it when several cards share a row.
   */
  compact?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  hint,
  compact = false,
}: StatCardProps) {
  if (compact) {
    return (
      <Card className="p-3.5 md:p-4">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-muted">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-control',
              TONES[tone],
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">{label}</span>
        </p>
        <div className="mt-2 break-words text-xl font-extrabold tabular-nums text-ink md:text-2xl">
          {value}
        </div>
        {hint && <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
      </Card>
    )
  }
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-control',
          TONES[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <div className="mt-0.5 break-words text-xl font-extrabold tabular-nums text-ink md:text-2xl">
          {value}
        </div>
        {hint && <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
      </div>
    </Card>
  )
}
