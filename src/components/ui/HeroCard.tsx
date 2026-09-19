import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Navy→blue hero surface with faint pitch lines and a thin pink accent along the bottom. */
export function HeroCard({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-card bg-linear-to-br from-brand-navy to-brand-blue p-5 text-white shadow-card md:p-6',
        className,
      )}
      {...props}
    >
      <div aria-hidden className="pitch-lines absolute inset-0" />
      <div className="relative">{children}</div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-brand-pink" />
    </section>
  )
}
