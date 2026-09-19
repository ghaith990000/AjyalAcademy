import '@tanstack/react-query'

declare module '@tanstack/react-query' {
  interface Register {
    /** `silent: true` — the caller shows its own error UI, so skip the global error toast. */
    queryMeta: { silent?: boolean }
    mutationMeta: { silent?: boolean }
  }
}
