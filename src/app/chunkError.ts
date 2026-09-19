/** The message a failed lazy import gives, in each browser: the app changed under an open page or the network dropped. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|importing a module script failed|failed to fetch|loading chunk|loading css chunk/i.test(
    message,
  )
}
