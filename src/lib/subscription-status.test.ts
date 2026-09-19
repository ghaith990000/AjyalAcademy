import { describe, expect, it } from 'vitest'
import { subscriptionStatus } from './subscription-status'

const period = { start_date: '2026-10-01', end_date: '2026-10-31', cancelled_at: null }
const status = (today: string, overrides = {}, days = 7) =>
  subscriptionStatus({ ...period, ...overrides }, today, days)

describe('subscriptionStatus', () => {
  it('is upcoming before the start date and expired after the end date', () => {
    expect(status('2026-09-30')).toBe('upcoming')
    expect(status('2026-11-01')).toBe('expired')
  })

  it('is active from the first day and stays active through the last', () => {
    expect(status('2026-10-01')).toBe('active')
    expect(status('2026-10-15')).toBe('active')
  })

  it('becomes expiring soon within the configured number of days, including the last day', () => {
    expect(status('2026-10-23')).toBe('active') // 8 days left
    expect(status('2026-10-24')).toBe('expiring_soon') // 7 days left
    expect(status('2026-10-31')).toBe('expiring_soon') // last day
  })

  it('honours a different warning window, and a zero window', () => {
    expect(status('2026-10-27', {}, 3)).toBe('active')
    expect(status('2026-10-28', {}, 3)).toBe('expiring_soon')
    expect(status('2026-10-30', {}, 0)).toBe('active')
    expect(status('2026-10-31', {}, 0)).toBe('expiring_soon')
  })

  it('cancelled wins over every date-based status', () => {
    for (const today of ['2026-09-01', '2026-10-15', '2026-12-01']) {
      expect(status(today, { cancelled_at: '2026-10-10T08:00:00Z' })).toBe('cancelled')
    }
  })

  it('works for a one-day subscription', () => {
    const oneDay = { start_date: '2026-10-05', end_date: '2026-10-05' }
    expect(status('2026-10-04', oneDay)).toBe('upcoming')
    expect(status('2026-10-05', oneDay)).toBe('expiring_soon')
    expect(status('2026-10-06', oneDay)).toBe('expired')
  })
})
