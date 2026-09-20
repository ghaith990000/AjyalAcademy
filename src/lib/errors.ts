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
    e.name === 'FunctionsFetchError' ||
    // supabase-js (PostgREST) does not throw a failed fetch: it returns it as an error object whose message is
    // "TypeError: Failed to fetch" (Chrome), "TypeError: Load failed" (Safari), "TypeError: NetworkError …" (Firefox).
    /^(TypeError|FetchError): /.test(message)
  ) {
    return 'network'
  }
  if (e.code === '42501' || e.status === 403 || message.startsWith('ajyal:forbidden')) {
    return 'forbidden'
  }
  if (e.code === 'PGRST301' || e.status === 401 || e.code === 'bad_jwt') return 'session'
  return 'generic'
}

/** The `<code>` of an `ajyal:<code>` error raised by one of our SQL functions, or null for anything else. */
export function ajyalCodeOf(error: unknown): string | null {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? error.message : ''
  return typeof message === 'string' ? (/^ajyal:([a-z_]+)/.exec(message)?.[1] ?? null) : null
}

/** PostgREST puts a function's RAISE ... DETAIL in `details` (e.g. the ids of overlapping players). */
export function errorDetailOf(error: unknown): string | null {
  const details =
    typeof error === 'object' && error !== null && 'details' in error ? error.details : null
  return typeof details === 'string' && details !== '' ? details : null
}
