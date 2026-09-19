import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import {
  cancelSubscription,
  createSubscription,
  getDiscountLabel,
  getSubscription,
  getSubscriptionPayments,
  getSubscriptionPlayers,
  listApplicableDiscounts,
  listPlayerStatuses,
  listPlayerSubscriptions,
  listReturningPlayers,
  listSubscriptions,
  recordPayment,
  type CreateSubscriptionParams,
  type RecordPaymentParams,
  type SubscriptionFilters,
} from './api'

const KEY = ['subscriptions'] as const

/** Shared pages live under both prefixes; links must stay inside the caller's own area. */
export function useSubscriptionsBasePath(): string {
  const { profile } = useAuth()
  return profile?.role === 'admin' ? '/admin/subscriptions' : '/coach/subscriptions'
}

export function useSubscriptionsList(filters: SubscriptionFilters) {
  const query = useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: ({ pageParam }) => listSubscriptions(filters, pageParam),
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

export function useSubscription(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => getSubscription(id),
    meta: { silent: true },
  })
}

export function useSubscriptionPlayers(id: string) {
  return useQuery({
    queryKey: [...KEY, 'players', id],
    queryFn: () => getSubscriptionPlayers(id),
    meta: { silent: true },
  })
}

export function useSubscriptionPayments(id: string) {
  return useQuery({
    queryKey: [...KEY, 'payments', id],
    queryFn: () => getSubscriptionPayments(id),
    meta: { silent: true },
  })
}

export function useDiscountLabel(id: string | null) {
  return useQuery({
    queryKey: ['discounts', 'label', id],
    queryFn: () => getDiscountLabel(id!),
    enabled: id !== null,
    meta: { silent: true },
  })
}

export function usePlayerSubscriptions(playerId: string) {
  return useQuery({
    queryKey: [...KEY, 'player', playerId],
    queryFn: () => listPlayerSubscriptions(playerId),
    meta: { silent: true },
  })
}

/** Statuses for the players on screen (the list badge). A missing key means "no subscription". */
export function usePlayerStatuses(playerIds: string[]) {
  const ids = [...playerIds].sort()
  return useQuery({
    queryKey: [...KEY, 'player-status', ids],
    queryFn: () => listPlayerStatuses(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    meta: { silent: true }, // the badge is a nicety; the list works without it
  })
}

export function useReturningPlayers(playerIds: string[]) {
  const ids = [...playerIds].sort()
  return useQuery({
    queryKey: [...KEY, 'returning', ids],
    queryFn: () => listReturningPlayers(ids),
    enabled: ids.length > 0,
    meta: { silent: true },
  })
}

export function useApplicableDiscounts() {
  return useQuery({
    queryKey: ['discounts', 'applicable'],
    queryFn: listApplicableDiscounts,
    meta: { silent: true },
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateSubscriptionParams) => createSubscription(params),
    meta: { silent: true }, // the wizard maps the business-rule errors to its own messages
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: RecordPaymentParams) => recordPayment(params),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelSubscription(id, reason),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
