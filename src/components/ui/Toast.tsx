import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { useCallback, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ToastContext, type ToastOptions, type ToastTone } from './toast-context'

interface ToastItem extends ToastOptions {
  id: number
  tone: ToastTone
}

const TONE = {
  success: { icon: CircleCheck, accent: 'text-success' },
  error: { icon: CircleAlert, accent: 'text-danger' },
  info: { icon: Info, accent: 'text-brand-blue' },
} as const

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('ui')
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((options: ToastOptions) => {
    setItems((current) => [...current, { ...options, tone: options.tone ?? 'info', id: nextId++ }])
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      <ToastPrimitive.Provider swipeDirection="down" duration={4500}>
        {children}
        {items.map((item) => {
          const { icon: Icon, accent } = TONE[item.tone]
          return (
            <ToastPrimitive.Root
              key={item.id}
              defaultOpen
              onOpenChange={(open) => {
                if (!open) setItems((current) => current.filter((entry) => entry.id !== item.id))
              }}
              className="flex w-full animate-toast-in items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-float"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', accent)} aria-hidden />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="font-semibold text-ink">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-[15px] text-ink-muted">
                    {item.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label={t('dismiss')}
                className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-page"
              >
                <X className="size-4" aria-hidden />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
        {/* Above the phone tab bar; bottom corner (end side) on larger screens. */}
        <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-20 z-[60] mx-auto flex w-full max-w-sm list-none flex-col gap-2 px-4 outline-none md:inset-x-auto md:end-6 md:bottom-6 md:mx-0 md:px-0" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
