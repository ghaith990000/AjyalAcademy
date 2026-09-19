/**
 * "Your session has ended" — remembered across the redirect to the login screen. Stored in sessionStorage so it
 * belongs to this tab and is gone once the login screen has shown it; a sign-out the person chose never sets it.
 */
const KEY = 'ajyal.sessionEnded'

export function markSessionEnded(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* blocked storage: the login screen just won't explain */
  }
}

export function sessionEndedNotice(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function clearSessionEndedNotice(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
