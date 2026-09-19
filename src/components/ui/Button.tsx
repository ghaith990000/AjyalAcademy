import type { VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button-variants'

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  /** Render the child element (e.g. a router <Link>) with button styling. */
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  loading = false,
  asChild = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const { t } = useTranslation('ui')
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className)

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
      {loading && <span className="sr-only">{t('loading')}</span>}
    </button>
  )
}
