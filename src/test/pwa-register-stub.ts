/** Stands in for `virtual:pwa-register/react` (made by vite-plugin-pwa) under test: no service worker, no update. */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: () => Promise.resolve(),
  }
}
