import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { useActivityRealtime } from './hooks'

vi.mock('@/lib/supabase', () => ({ supabase: { channel: vi.fn(), removeChannel: vi.fn() } }))

/** A stand-in for a Supabase Realtime channel that lets the test play the server's part. */
function fakeChannel() {
  const handlers: { insert?: () => void; status?: (status: string) => void } = {}
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
      handlers.insert = callback
      return channel
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      handlers.status = callback
      return channel
    }),
  }
  vi.mocked(supabase.channel).mockReturnValue(channel as never)
  return { channel, handlers }
}

function setup() {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { invalidate, wrapper }
}

describe('useActivityRealtime', () => {
  beforeEach(() => vi.resetAllMocks())

  it('listens for new activity_log rows', () => {
    const { channel } = fakeChannel()
    const { wrapper } = setup()
    renderHook(() => useActivityRealtime(), { wrapper })
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      expect.any(Function),
    )
    expect(channel.subscribe).toHaveBeenCalledOnce()
  })

  it('refreshes the feed and the numbers that depend on the same data when a row arrives', () => {
    const { handlers } = fakeChannel()
    const { invalidate, wrapper } = setup()
    renderHook(() => useActivityRealtime(), { wrapper })

    act(() => handlers.insert?.())

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual([['activity'], ['home'], ['reports'], ['sessions']])
  })

  it('reports whether the live connection is up', () => {
    const { handlers } = fakeChannel()
    const { wrapper } = setup()
    const { result } = renderHook(() => useActivityRealtime(), { wrapper })
    expect(result.current).toBe(false)

    act(() => handlers.status?.('SUBSCRIBED'))
    expect(result.current).toBe(true)

    act(() => handlers.status?.('CHANNEL_ERROR'))
    expect(result.current).toBe(false)
  })

  it('closes the channel when the screen goes away', () => {
    const { channel } = fakeChannel()
    const { wrapper } = setup()
    const { unmount } = renderHook(() => useActivityRealtime(), { wrapper })
    unmount()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('uses a channel of its own each time, so two screens never share one', () => {
    fakeChannel()
    const { wrapper } = setup()
    renderHook(() => useActivityRealtime(), { wrapper })
    renderHook(() => useActivityRealtime(), { wrapper })
    const [first, second] = vi.mocked(supabase.channel).mock.calls.map(([name]) => name)
    expect(first).not.toBe(second)
  })
})
