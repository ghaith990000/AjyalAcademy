import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Shared look for text-like controls (Input, Textarea, Select). 16px text avoids iOS zoom-on-focus. */
export const controlClass =
  'block w-full min-h-11 rounded-control border border-line bg-surface px-3.5 text-base text-ink transition-colors placeholder:text-ink-muted/70 focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30 disabled:cursor-not-allowed disabled:bg-page disabled:text-ink-muted'

interface InputProps extends ComponentProps<'input'> {
  /** Force left-to-right (emails, phones, CPR, codes) even inside an RTL page. */
  ltr?: boolean
  /** Element pinned to the end of the field (e.g. show/hide password button). */
  endAdornment?: ReactNode
}

export function Input({ className, ltr, endAdornment, ...props }: InputProps) {
  const control = (
    <input
      className={cn(controlClass, endAdornment && 'pe-12', className)}
      {...props}
      dir={ltr ? 'ltr' : props.dir}
    />
  )
  if (!endAdornment) return control
  return (
    // Same direction as the input, so `end` (where the adornment sits) matches the text's end.
    <div className="relative" dir={ltr ? 'ltr' : props.dir}>
      {control}
      <div className="absolute inset-y-0 end-0.5 flex items-center">{endAdornment}</div>
    </div>
  )
}
