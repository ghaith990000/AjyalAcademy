import { cn } from '@/lib/utils'
import { Shield } from './Shield'

const SIZES = { sm: 32, md: 44, lg: 64 } as const

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
}

interface AvatarProps {
  name: string
  size?: keyof typeof SIZES
  className?: string
}

/** Shield-shaped avatar with the person's initials (works for Arabic and Latin names). */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const width = SIZES[size]
  return (
    <span
      role="img"
      aria-label={name}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width, height: width * 1.2 }}
    >
      <Shield className="absolute inset-0 size-full" />
      <span
        aria-hidden
        className="relative font-bold leading-none text-brand-blue"
        style={{ fontSize: width * 0.34 }}
      >
        {initialsOf(name)}
      </span>
    </span>
  )
}
