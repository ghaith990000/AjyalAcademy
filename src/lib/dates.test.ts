import { describe, expect, it } from 'vitest'
import {
  ageInYears,
  formatDate,
  formatLongDate,
  formatTime,
  isValidISODate,
  todayISO,
} from './dates'

describe('dates', () => {
  it('formats dd/MM/yyyy from a date-only ISO string without timezone drift', () => {
    expect(formatDate('2026-09-19')).toBe('19/09/2026')
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })

  it('formats long dates per language with Latin digits', () => {
    expect(formatLongDate('2026-09-19', 'en')).toBe('Saturday 19 September')
    expect(formatLongDate('2026-09-19', 'ar')).toMatch(/^[^\d]+ 19 [^\d]+$/)
  })

  it('formats times as 12-hour with a language-specific meridiem', () => {
    expect(formatTime('16:30', 'en')).toBe('4:30 PM')
    expect(formatTime('09:05', 'en')).toBe('9:05 AM')
    expect(formatTime('16:30', 'ar')).toMatch(/^4:30 [^\d\s]+$/)
  })
})

describe('age and calendar helpers', () => {
  const today = new Date(2026, 8, 19) // 19 Sep 2026

  it('counts whole years, turning a year older on the birthday itself', () => {
    expect(ageInYears('2015-09-19', today)).toBe(11)
    expect(ageInYears('2015-09-20', today)).toBe(10)
    expect(ageInYears('2015-01-01', today)).toBe(11)
    expect(ageInYears('2026-03-01', today)).toBe(0)
  })

  it('handles a 29 February birthday', () => {
    expect(ageInYears('2016-02-29', new Date(2026, 1, 28))).toBe(9)
    expect(ageInYears('2016-02-29', new Date(2026, 2, 1))).toBe(10)
  })

  it('formats today as yyyy-MM-dd in local time', () => {
    expect(todayISO(today)).toBe('2026-09-19')
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('accepts only real calendar dates written as yyyy-MM-dd', () => {
    expect(isValidISODate('2016-02-29')).toBe(true)
    for (const bad of ['', '2015-02-31', '2015-13-01', '15-1-1', '2015/01/01', 'abc']) {
      expect(isValidISODate(bad), bad).toBe(false)
    }
  })
})
