import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  acceptApplication,
  APPLICATIONS_PAGE_SIZE,
  countPendingApplications,
  getApplication,
  listApplications,
  rejectApplication,
  type AcceptInput,
  type ApplicationStatus,
} from './api'

export const APPLICATIONS_KEY = ['applications'] as const

/** How often the waiting count is looked at when nothing pushes a change (the live feed refreshes it sooner). */
const COUNT_REFRESH_MS = 60_000

export function useApplicationsList(status: ApplicationStatus) {
  const query = useInfiniteQuery({
    queryKey: [...APPLICATIONS_KEY, 'list', status],
    queryFn: ({ pageParam }) => listApplications(status, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total && last.rows.length === APPLICATIONS_PAGE_SIZE
        ? pages.length
        : undefined
    },
    placeholderData: keepPreviousData,
    meta: { silent: true }, // ApplicationsPage renders its own load-error state
  })
  return {
    ...query,
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  }
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: [...APPLICATIONS_KEY, 'detail', id],
    queryFn: () => getApplication(id),
    meta: { silent: true }, // the detail page renders its own load-error state
  })
}

/** How many requests wait for a decision: the admin's home card and the navigation badge. */
export function usePendingApplicationCount({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...APPLICATIONS_KEY, 'pending-count'],
    queryFn: countPendingApplications,
    enabled,
    refetchInterval: COUNT_REFRESH_MS,
    meta: { silent: true },
  })
}

/** A decision changes the list, the count, the players (an accepted child is one now) and the feed. */
function useRefreshAfterDecision() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [APPLICATIONS_KEY, ['players'], ['home'], ['activity']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
}

export function useAcceptApplication() {
  const refresh = useRefreshAfterDecision()
  return useMutation({
    mutationFn: (input: AcceptInput) => acceptApplication(input),
    meta: { silent: true }, // the dialog explains a taken CPR and other refusals itself
    onSuccess: refresh,
  })
}

export function useRejectApplication() {
  const refresh = useRefreshAfterDecision()
  return useMutation({
    mutationFn: (input: { id: string; note: string }) => rejectApplication(input),
    meta: { silent: true },
    onSuccess: refresh,
  })
}
