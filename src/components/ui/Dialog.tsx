import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { IconButton } from './IconButton'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Element that opens the dialog (optional when controlled). */
  trigger?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  /** Action buttons; stacked full-width on phones, inline on larger screens. */
  footer?: ReactNode
  /** Use the whole screen on phones (long forms). Still a centred dialog from `md`. */
  fullOnMobile?: boolean
}

/** Bottom sheet on phones, centred dialog from `md`. Focus-trapped and labelled by Radix. */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  fullOnMobile = false,
}: DialogProps) {
  const { t } = useTranslation('ui')
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-navy/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-3xl bg-surface shadow-float outline-none md:inset-0 md:m-auto md:h-fit md:max-w-lg md:animate-pop-in md:rounded-card',
            fullOnMobile && 'max-md:inset-0 max-md:h-dvh max-md:max-h-none max-md:rounded-none',
          )}
        >
          <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line md:hidden" />
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-3 md:pt-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-bold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label={t('close')} icon={<X className="size-5" aria-hidden />} />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="pb-safe flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
