import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './Card'

const TONES = {
  blue: 'bg-brand-blue-50 text-brand-blue',
  pink: 'bg-brand-pink-50 text-brand-pink',
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
}

export function StatCard({ label, value, icon: Icon, tone = 'blue', hint }: StatCardProps) {
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
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
      </div>
    </Card>
  )
}
