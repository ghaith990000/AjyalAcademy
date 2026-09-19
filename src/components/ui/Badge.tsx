import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-page text-ink-muted ring-1 ring-line',
        info: 'bg-brand-blue-50 text-brand-blue',
        accent: 'bg-brand-pink-50 text-brand-pink',
        success: 'bg-success-50 text-success',
        warning: 'bg-warning-50 text-warning',
        danger: 'bg-danger-50 text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

/** Status pill. Always carries text (never color alone) and a leading dot for scanning. */
export function Badge({ tone, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
