import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** The Ajyal shield silhouette (from the logo): white body, pink outline. Aspect ratio 5:6. */
export function Shield({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
      {...props}
    >
      <path
        d="M50 4 92 16v46c0 26-22 44-42 54C30 106 8 88 8 62V16z"
        className="fill-surface stroke-brand-pink"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
