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
  /** `h1` when the state IS the page (not found, a crash); `h2` when it sits inside a page. */
  titleAs?: 'h1' | 'h2'
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  titleAs: Title = 'h2',
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <span className="relative flex h-24 w-20 items-center justify-center">
        <Shield className="absolute inset-0 size-full drop-shadow-sm" />
        <Icon className="relative -mt-1 size-8 text-brand-blue" aria-hidden />
      </span>
      <Title className="mt-4 text-lg font-bold text-ink">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
