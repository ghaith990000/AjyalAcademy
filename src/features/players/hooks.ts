import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import {
  assignPlayers,
  createPlayer,
  getPlayer,
  listPlayers,
  removePlayer,
  updatePlayer,
  type PlayerFilters,
} from './api'
import type { PlayerInput } from './schema'

const PLAYERS_KEY = ['players'] as const

/** Shared pages live under both prefixes; links must stay inside the caller's own area. */
export function usePlayersBasePath(): string {
  const { profile } = useAuth()
  return profile?.role === 'admin' ? '/admin/players' : '/coach/players'
}

export function usePlayersList(filters: PlayerFilters) {
  const query = useInfiniteQuery({
    queryKey: [...PLAYERS_KEY, 'list', filters],
    queryFn: ({ pageParam }) => listPlayers(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? pages.length : undefined
    },
    // Keep the old rows on screen while a new search/filter loads.
    placeholderData: keepPreviousData,
    meta: { silent: true }, // PlayersPage renders its own load-error state
  })
  return {
    ...query,
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  }
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: [...PLAYERS_KEY, 'detail', id],
    queryFn: () => getPlayer(id),
    meta: { silent: true }, // PlayerDetailPage renders its own load-error state
  })
}

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlayerInput) => createPlayer(input),
    meta: { silent: true }, // the form reports duplicate CPRs itself
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAYERS_KEY }),
  })
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PlayerInput }) => updatePlayer(id, input),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAYERS_KEY }),
  })
}

export function useRemovePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removePlayer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAYERS_KEY }),
  })
}

export function useAssignPlayers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, coachId }: { ids: string[]; coachId: string | null }) =>
      assignPlayers(ids, coachId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAYERS_KEY }),
  })
}
