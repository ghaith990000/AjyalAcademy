import { Direction } from 'radix-ui'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { useLanguage } from '@/lib/useLanguage'
import { QueryProvider } from './QueryProvider'

/** App-wide providers: text direction, toasts, and TanStack Query (with base error handling). */
export function Providers({ children }: { children: ReactNode }) {
  const { rtl } = useLanguage()
  return (
    <Direction.Provider dir={rtl ? 'rtl' : 'ltr'}>
      <ToastProvider>
        <QueryProvider>{children}</QueryProvider>
      </ToastProvider>
    </Direction.Provider>
  )
}
