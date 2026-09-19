import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCoach, listCoaches, updateCoach, type CoachChanges, type NewCoach } from './api'

const COACHES_KEY = ['coaches'] as const

/** Admin-only data (RLS shows coaches nothing but themselves); pass `enabled: false` for others. */
export function useCoaches({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: COACHES_KEY,
    queryFn: listCoaches,
    enabled,
    meta: { silent: true }, // CoachesPage renders its own load-error state
  })
}

export function useCreateCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewCoach) => createCoach(input),
    meta: { silent: true }, // the form maps expected failures (email taken, weak password) itself
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COACHES_KEY }),
  })
}

export function useUpdateCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: CoachChanges }) =>
      updateCoach(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COACHES_KEY }),
  })
}
