import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'

export type Profile = Tables<'profiles'>
export type UserRole = Profile['role']

/**
 * loading   — restoring the session or fetching the profile
 * signedOut — no (usable) session
 * signedIn  — active user with a profile
 * error     — signed in, but the profile could not be loaded (e.g. offline)
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error'

export type SignInError = 'invalidCredentials' | 'inactive' | 'network' | 'unknown'
export type SignInResult = { ok: true } | { ok: false; error: SignInError }

export interface AuthState {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  /** Retry loading the profile after `status === 'error'`. */
  retry: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

/** Where each role lands after signing in. */
export function homePathFor(role: UserRole): string {
  return role === 'admin' ? '/admin' : '/coach'
}
