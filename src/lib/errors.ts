/** Keys of the `errors` i18n namespace that a thrown value can map to. */
export type ErrorKey = 'network' | 'forbidden' | 'session' | 'generic'

interface ErrorLike {
  name?: unknown
  code?: unknown
  status?: unknown
  message?: unknown
}

/**
 * Classify anything thrown by supabase-js (PostgREST, Auth, Functions) into a user-facing category.
 * Callers translate it with `t(`errors:${errorKeyOf(error)}`)`; raw messages are never shown to users.
 */
export function errorKeyOf(error: unknown): ErrorKey {
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const message = typeof e.message === 'string' ? e.message : ''

  if (
    error instanceof TypeError || // fetch() rejects with TypeError when offline
    e.name === 'AuthRetryableFetchError' ||
    e.name === 'FunctionsFetchError'
  ) {
    return 'network'
  }
  if (e.code === '42501' || e.status === 403 || message.startsWith('ajyal:forbidden')) {
    return 'forbidden'
  }
  if (e.code === 'PGRST301' || e.status === 401 || e.code === 'bad_jwt') return 'session'
  return 'generic'
}
