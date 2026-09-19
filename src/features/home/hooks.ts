import { useQuery } from '@tanstack/react-query'
import { countActiveSubscriptions, countPlayers, listExpiringSubscriptions } from './api'

const KEY = ['home'] as const

// Each home card renders its own loading and error state, so none of these raise the global toast.
export function usePlayersCount() {
  return useQuery({ queryKey: [...KEY, 'players'], queryFn: countPlayers, meta: { silent: true } })
}

export function useActiveSubscriptionsCount({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: [...KEY, 'subscriptions'],
    queryFn: countActiveSubscriptions,
    enabled,
    meta: { silent: true },
  })
}

export function useExpiringSubscriptions() {
  return useQuery({
    queryKey: [...KEY, 'expiring'],
    queryFn: listExpiringSubscriptions,
    meta: { silent: true },
  })
}
