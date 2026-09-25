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
  /** A resolved (signed) URL for the player's photo, when one is set. */
  photoUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
}

/** A photo when one is set, otherwise the shield-shaped initials (works for Arabic and Latin names). */
export function Avatar({ name, photoUrl, size = 'md', className }: AvatarProps) {
  const width = SIZES[size]
  if (photoUrl) {
    return (
      <span
        className={cn(
          'inline-block shrink-0 overflow-hidden rounded-full border border-line bg-page',
          className,
        )}
        style={{ width, height: width }}
      >
        <img src={photoUrl} alt={name} className="size-full object-cover" />
      </span>
    )
  }
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
