import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSessionEndedNotice, markSessionEnded, sessionEndedNotice } from './sessionNotice'

describe('session-ended notice', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('is off until marked, on after, and off again once cleared', () => {
    expect(sessionEndedNotice()).toBe(false)
    markSessionEnded()
    expect(sessionEndedNotice()).toBe(true)
    clearSessionEndedNotice()
    expect(sessionEndedNotice()).toBe(false)
  })

  it('does not throw when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => markSessionEnded()).not.toThrow()
    expect(sessionEndedNotice()).toBe(false)
    expect(() => clearSessionEndedNotice()).not.toThrow()
  })
})
