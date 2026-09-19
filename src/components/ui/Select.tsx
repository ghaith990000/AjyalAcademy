import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { controlClass } from './Input'

/** Native <select>: best UX on phones (OS picker), RTL-safe, accessible for free. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, 'appearance-none pe-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 end-3 my-auto size-5 text-ink-muted"
        aria-hidden
      />
    </div>
  )
}
