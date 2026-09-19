import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast-context'
import { errorKeyOf } from '@/lib/errors'

/**
 * TanStack Query with base error handling: a failed request that no screen handled itself
 * (`meta.silent`) surfaces as a translated error toast. Must sit inside `ToastProvider`.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const { t } = useTranslation('errors')

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Retry only flaky connections, never permission or validation errors.
            retry: (failureCount, error) => failureCount < 2 && errorKeyOf(error) === 'network',
          },
        },
      }),
  )

  useEffect(() => {
    const notify = (error: unknown) =>
      toast({ title: t('title'), description: t(errorKeyOf(error)), tone: 'error' })

    // 'error' actions are dispatched only after retries are exhausted.
    const stopQueries = client.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      // A failed background refetch keeps showing the data we already have.
      if (event.query.state.data === undefined && !event.query.meta?.silent) {
        notify(event.action.error)
      }
    })
    const stopMutations = client.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      if (!event.mutation.meta?.silent) notify(event.action.error)
    })
    return () => {
      stopQueries()
      stopMutations()
    }
  }, [client, toast, t])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
