import { vi } from 'vitest'
import type { AuthState, Profile } from '@/features/auth/auth-context'

export function fakeProfile(role: Profile['role'], overrides: Partial<Profile> = {}): Profile {
  return {
    id: role === 'admin' ? 'admin-1' : 'coach-1',
    full_name: role === 'admin' ? 'Demo Admin' : 'Khalid Al Dosari',
    email: `${role}@example.com`,
    role,
    phone: null,
    monthly_salary_fils: 0,
    active: true,
    preferred_language: 'ar',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Auth state for tests: `role` signs that user in, `null` signs everyone out. */
export function fakeAuth(
  role: Profile['role'] | null,
  overrides: Partial<AuthState> = {},
): AuthState {
  return {
    status: role ? 'signedIn' : 'signedOut',
    session: null,
    profile: role ? fakeProfile(role) : null,
    signIn: vi.fn().mockResolvedValue({ ok: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    ...overrides,
  }
}
