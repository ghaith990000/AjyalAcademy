import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 19, 12, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('moves on by itself, so "5 minutes ago" keeps counting', () => {
    const { result } = renderHook(() => useNow(30_000))
    const first = result.current.getTime()
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current.getTime()).toBe(first + 30_000)
  })

  it('stops ticking when the screen goes away', () => {
    const { unmount } = renderHook(() => useNow(1000))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
