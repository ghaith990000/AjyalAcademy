import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLocation, listLocations, updateLocation, type LocationInput } from './api'

export const LOCATIONS_KEY = ['locations'] as const

/** All locations, by name. The list is tiny and read on most screens, so it stays fresh for a while. */
export function useLocations() {
  return useQuery({
    queryKey: LOCATIONS_KEY,
    queryFn: listLocations,
    staleTime: 5 * 60_000,
    meta: { silent: true }, // pages that show it draw their own load-error state (or just fall back to no names)
  })
}

export function useCreateLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LocationInput) => createLocation(input),
    meta: { silent: true }, // the form reports a duplicate name itself
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCATIONS_KEY }),
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LocationInput }) => updateLocation(id, input),
    meta: { silent: true },
    // A renamed or switched-off location shows in sessions, subscriptions, expenses and reports.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
