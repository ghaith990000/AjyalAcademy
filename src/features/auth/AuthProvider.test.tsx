import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { fakeProfile } from '@/test/auth'
import type { Profile, SignInResult } from './auth-context'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

// A minimal stand-in for the Supabase client: just the calls AuthProvider makes.
const fake = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: unknown) => void) | undefined,
  profile: null as unknown,
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  updateEq: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        fake.listener = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signOut: fake.signOut,
      signInWithPassword: fake.signInWithPassword,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: fake.profile, error: null }) }),
      }),
      update: fake.update,
    }),
  },
}))

// The Probe hands `signIn` out to the tests through this object (set in an effect, not during render).
const captured = {} as { signIn: (email: string, password: string) => Promise<SignInResult> }
const signIn = (email: string, password: string) => captured.signIn(email, password)

function Probe() {
  const auth = useAuth()
  useEffect(() => {
    captured.signIn = auth.signIn
  }, [auth.signIn])
  return <p data-testid="state">{`${auth.status}|${auth.profile?.role ?? 'none'}`}</p>
}

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

const state = () => screen.getByTestId('state').textContent
const emit = (event: string, session: unknown) => act(() => fake.listener?.(event, session))
const session = { user: { id: 'u1' } }

describe('AuthProvider', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    fake.listener = undefined
    fake.profile = fakeProfile('admin', { id: 'u1' })
    fake.signOut.mockImplementation(async () => fake.listener?.('SIGNED_OUT', null))
    fake.updateEq.mockResolvedValue({ error: null })
    fake.update.mockReturnValue({ eq: fake.updateEq })
    await i18n.changeLanguage('ar')
  })

  it('is loading until the stored session has been restored, then signed out', async () => {
    renderProvider()
    expect(state()).toBe('loading|none')
    await emit('INITIAL_SESSION', null)
    expect(state()).toBe('signedOut|none')
  })

  it('exposes the role of an active user once the profile has loaded', async () => {
    renderProvider()
    await emit('INITIAL_SESSION', session)
    await waitFor(() => expect(state()).toBe('signedIn|admin'))
  })

  it.each([
    ['is deactivated', fakeProfile('coach', { id: 'u1', active: false })],
    ['has no profile', null],
  ])('signs out a user who %s', async (_case, profile) => {
    fake.profile = profile
    renderProvider()
    await emit('INITIAL_SESSION', session)
    await waitFor(() => expect(fake.signOut).toHaveBeenCalled())
    await waitFor(() => expect(state()).toBe('signedOut|none'))
  })

  it("applies the profile's language once after sign-in without writing it back", async () => {
    fake.profile = fakeProfile('coach', { id: 'u1', preferred_language: 'en' })
    renderProvider()
    await emit('INITIAL_SESSION', session)
    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'))
    expect(fake.update).not.toHaveBeenCalled()
  })

  it('saves a later language toggle to the profile', async () => {
    fake.profile = fakeProfile('coach', { id: 'u1', preferred_language: 'ar' })
    renderProvider()
    await emit('INITIAL_SESSION', session)
    await waitFor(() => expect(state()).toBe('signedIn|coach'))

    await act(() => i18n.changeLanguage('en'))
    await waitFor(() => expect(fake.update).toHaveBeenCalledWith({ preferred_language: 'en' }))
    expect(fake.updateEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('clears the profile on sign-out', async () => {
    renderProvider()
    await emit('INITIAL_SESSION', session)
    await waitFor(() => expect(state()).toBe('signedIn|admin'))
    await emit('SIGNED_OUT', null)
    expect(state()).toBe('signedOut|none')
  })

  describe('signIn', () => {
    beforeEach(async () => {
      renderProvider()
      await emit('INITIAL_SESSION', null)
    })

    it('succeeds for an active user', async () => {
      fake.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      await expect(signIn('a@b.co', 'pw')).resolves.toEqual({ ok: true })
      expect(fake.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' })
    })

    it('maps a wrong password to invalidCredentials', async () => {
      fake.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { code: 'invalid_credentials', name: 'AuthApiError', message: 'x' },
      })
      await expect(signIn('a@b.co', 'bad')).resolves.toEqual({
        ok: false,
        error: 'invalidCredentials',
      })
    })

    it('maps a dropped connection to network', async () => {
      fake.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'x' },
      })
      await expect(signIn('a@b.co', 'pw')).resolves.toEqual({ ok: false, error: 'network' })
    })

    it('refuses an inactive account and signs it straight out', async () => {
      fake.profile = fakeProfile('coach', { id: 'u1', active: false } as Partial<Profile>)
      fake.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      await expect(signIn('a@b.co', 'pw')).resolves.toEqual({ ok: false, error: 'inactive' })
      expect(fake.signOut).toHaveBeenCalled()
    })
  })
})
