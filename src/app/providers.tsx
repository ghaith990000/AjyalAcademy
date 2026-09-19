import { Direction } from 'radix-ui'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { useLanguage } from '@/lib/useLanguage'

/** App-wide providers. Data (TanStack Query) and auth providers are added in Phase 2. */
export function Providers({ children }: { children: ReactNode }) {
  const { rtl } = useLanguage()
  return (
    <Direction.Provider dir={rtl ? 'rtl' : 'ltr'}>
      <ToastProvider>{children}</ToastProvider>
    </Direction.Provider>
  )
}
