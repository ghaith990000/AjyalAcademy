import type { ComponentProps, ReactNode } from 'react'
import { Button } from './Button'

interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'size' | 'children' | 'asChild'
> {
  /** Accessible name — already translated. Icon-only buttons must always have one. */
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <Button size="icon" variant={variant} aria-label={label} title={label} {...props}>
      {icon}
    </Button>
  )
}
