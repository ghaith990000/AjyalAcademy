import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { endSession } from './endSession'
import { sessionEndedNotice } from './sessionNotice'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

describe('endSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('remembers why and signs out locally (there is no server session left to revoke)', () => {
    endSession()
    expect(sessionEndedNotice()).toBe(true)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
