import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { todayISO } from '@/lib/dates'
import {
  cancelSession,
  createSessions,
  getSession,
  listCoachSessionsBetween,
  listTodaySessions,
  listSessions,
  updateSession,
  type SessionFilters,
} from './api'
import type { SessionInput } from './schema'

const KEY = ['sessions'] as const

/** Shared pages live under both prefixes; links must stay inside the caller's own area. */
export function useSessionsBasePath(): string {
  const { profile } = useAuth()
  return profile?.role === 'admin' ? '/admin/sessions' : '/coach/sessions'
}

export function useSessionsList(filters: SessionFilters) {
  const query = useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: ({ pageParam }) => listSessions(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? pages.length : undefined
    },
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
  return {
    ...query,
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  }
}

/** Today's sessions for the home screen; the key includes the date so a page left open overnight moves on. */
export function useTodaySessions() {
  return useQuery({
    queryKey: [...KEY, 'today', todayISO()],
    queryFn: listTodaySessions,
    meta: { silent: true }, // the home card renders its own load-error state
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => getSession(id),
    meta: { silent: true },
  })
}

/** The coach's sessions between two dates, for the form's overlap warning (a nicety, so errors stay quiet). */
export function useCoachSessionsBetween(
  coachId: string,
  from: string,
  to: string,
  { enabled }: { enabled: boolean },
) {
  return useQuery({
    queryKey: [...KEY, 'range', coachId, from, to],
    queryFn: () => listCoachSessionsBetween(coachId, from, to),
    enabled,
    meta: { silent: true },
  })
}

export function useCreateSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inputs: SessionInput[]) => createSessions(inputs),
    meta: { silent: true }, // the form maps the business-rule errors to its own messages
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SessionInput }) => updateSession(id, input),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCancelSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelSession(id),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
