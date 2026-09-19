/** Small, testable rules for "should we offer to install the app, and how". */

/** iPhone / iPad Safari cannot be asked to install — the person has to use the Share sheet. */
export function isIosDevice(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
}

/** True once the app is running from the home screen (nothing left to install). */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const DISMISSED_KEY = 'ajyal.installHint'

export function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false // storage can be blocked; showing the hint again is harmless
  }
}

export function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    /* blocked storage: the hint may come back next visit */
  }
}
