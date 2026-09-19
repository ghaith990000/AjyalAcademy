import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import i18n from '@/lib/i18n'
import { errorKeyOf } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import {
  AuthContext,
  type AuthState,
  type AuthStatus,
  type Profile,
  type SignInResult,
} from './auth-context'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

/**
 * Session + profile (role) for the whole app. Sits inside QueryProvider.
 * - inactive or profile-less users are signed out (the account exists but may not use the app);
 * - the profile's preferred language is applied once after sign-in, and language toggles are saved back.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [restored, setRestored] = useState(false)
  const userId = session?.user.id

  useEffect(() => {
    // Fires INITIAL_SESSION on subscribe, so no separate getSession() call is needed.
    // Keep this callback synchronous: awaiting supabase calls inside it can deadlock the client.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') queryClient.clear() // never leak one user's data to the next
      setSession(next)
      setRestored(true)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: userId !== undefined,
    meta: { silent: true }, // AuthProvider renders its own error state
  })
  const profile = profileQuery.data ?? null
  const usable = profile !== null && profile.active

  // A user who was deactivated (or never had a profile) must not stay signed in.
  const unusable = profileQuery.isSuccess && !usable
  useEffect(() => {
    if (unusable) void supabase.auth.signOut()
  }, [unusable])

  // Apply the saved language once per sign-in.
  const appliedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!session) appliedFor.current = null
    if (!profile || !profile.active || appliedFor.current === profile.id) return
    appliedFor.current = profile.id
    if (profile.preferred_language !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(profile.preferred_language)
    }
  }, [session, profile])

  // Save language toggles to the profile.
  useEffect(() => {
    if (!profile || !profile.active) return
    const persist = (language: string) => {
      if ((language !== 'ar' && language !== 'en') || language === profile.preferred_language) {
        return
      }
      void supabase
        .from('profiles')
        .update({ preferred_language: language })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (!error) {
            const saved: Profile = { ...profile, preferred_language: language }
            queryClient.setQueryData(['profile', profile.id], saved)
          }
        })
    }
    i18n.on('languageChanged', persist)
    return () => i18n.off('languageChanged', persist)
  }, [profile, queryClient])

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      if (error?.code === 'invalid_credentials') return { ok: false, error: 'invalidCredentials' }
      return { ok: false, error: errorKeyOf(error) === 'network' ? 'network' : 'unknown' }
    }
    try {
      const own = await fetchProfile(data.user.id)
      if (!own || !own.active) {
        await supabase.auth.signOut()
        return { ok: false, error: 'inactive' }
      }
    } catch (profileError) {
      await supabase.auth.signOut()
      return { ok: false, error: errorKeyOf(profileError) === 'network' ? 'network' : 'unknown' }
    }
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const retry = useCallback(() => void profileQuery.refetch(), [profileQuery])

  let status: AuthStatus
  if (!restored) status = 'loading'
  else if (!session) status = 'signedOut'
  else if (profileQuery.isError) status = 'error'
  else if (profileQuery.isPending || unusable) status = 'loading'
  else status = 'signedIn'

  const value = useMemo<AuthState>(
    () => ({ status, session, profile: usable ? profile : null, signIn, signOut, retry }),
    [status, session, profile, usable, signIn, signOut, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
