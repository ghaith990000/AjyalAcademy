import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countPlayerPresent,
  getSessionAttendance,
  listPlayerAttendance,
  listRoster,
  saveAttendance,
} from './api'
import type { SavedMark } from './marks'

const KEY = ['attendance'] as const

/** `coachId` is undefined until the session has loaded. */
export function useRoster(coachId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'roster', coachId],
    queryFn: () => listRoster(coachId!),
    enabled: coachId !== undefined,
    meta: { silent: true },
  })
}

export function useSessionAttendance(sessionId: string) {
  return useQuery({
    queryKey: [...KEY, 'session', sessionId],
    queryFn: () => getSessionAttendance(sessionId),
    meta: { silent: true },
  })
}

export function usePlayerAttendance(playerId: string) {
  const query = useInfiniteQuery({
    queryKey: [...KEY, 'player', playerId],
    queryFn: ({ pageParam }) => listPlayerAttendance(playerId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? pages.length : undefined
    },
    meta: { silent: true },
  })
  return {
    ...query,
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  }
}

export function usePlayerPresentCount(playerId: string) {
  return useQuery({
    queryKey: [...KEY, 'player-present', playerId],
    queryFn: () => countPlayerPresent(playerId),
    meta: { silent: true },
  })
}

export function useSaveAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, records }: { sessionId: string; records: SavedMark[] }) =>
      saveAttendance(sessionId, records),
    meta: { silent: true }, // the screen maps the business-rule errors to its own messages
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
