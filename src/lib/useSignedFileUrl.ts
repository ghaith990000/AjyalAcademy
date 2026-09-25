import { useQuery } from '@tanstack/react-query'
import { signedUrl } from './storage'

/** A short-lived URL for a private file in `player-files` (`null` path = nothing to fetch). */
export function useSignedFileUrl(path: string | null) {
  return useQuery({
    queryKey: ['file-url', path],
    queryFn: () => signedUrl(path as string),
    enabled: path !== null,
    staleTime: 4 * 60 * 1000,
    meta: { silent: true },
  })
}
