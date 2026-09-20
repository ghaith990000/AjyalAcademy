import { useQuery } from '@tanstack/react-query'
import { listPublicLocations } from './api'

export function usePublicLocations() {
  return useQuery({
    queryKey: ['register', 'locations'],
    queryFn: listPublicLocations,
    staleTime: 5 * 60_000,
    meta: { silent: true }, // the form still works without the list (the location is then simply left out)
  })
}
