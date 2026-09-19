import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Shield } from './Shield'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <span className="relative flex h-24 w-20 items-center justify-center">
        <Shield className="absolute inset-0 size-full drop-shadow-sm" />
        <Icon className="relative -mt-1 size-8 text-brand-blue" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
