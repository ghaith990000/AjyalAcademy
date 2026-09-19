import { describe, expect, it } from 'vitest'
import {
  ageInYears,
  defaultEndDate,
  formatDate,
  formatLongDate,
  formatRelative,
  formatMonthName,
  formatMonthYear,
  formatTime,
  formatTimeAgo,
  formatTimeRange,
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

describe('month names', () => {
  it('names a month and year in the language, with Latin digits', () => {
    expect(formatMonthYear(2026, 9, 'en')).toBe('September 2026')
    expect(formatMonthYear(2026, 9, 'ar')).toMatch(/^[^\d]+ 2026$/)
  })

  it('names a month on its own, long or short', () => {
    expect(formatMonthName(1, 'en')).toBe('January')
    expect(formatMonthName(12, 'en', 'short')).toBe('Dec')
    expect(formatMonthName(3, 'ar')).toMatch(/^[^\d]+$/)
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

describe('defaultEndDate', () => {
  it('is one month minus one day, inclusive', () => {
    expect(defaultEndDate('2026-10-01')).toBe('2026-10-31')
    expect(defaultEndDate('2026-10-15')).toBe('2026-11-14')
    expect(defaultEndDate('2026-12-15')).toBe('2027-01-14')
  })

  it('clamps at the end of a shorter month, matching Postgres (start + 1 month − 1 day)', () => {
    expect(defaultEndDate('2026-01-31')).toBe('2026-02-27')
    expect(defaultEndDate('2026-02-01')).toBe('2026-02-28')
    expect(defaultEndDate('2028-02-01')).toBe('2028-02-29')
  })
})

describe('formatTimeRange', () => {
  it('joins the two times with an en dash, in either language', () => {
    expect(formatTimeRange('16:00:00', '17:30:00', 'en')).toBe('4:00 PM – 5:30 PM')
    expect(formatTimeRange('09:05', '10:00', 'en')).toBe('9:05 AM – 10:00 AM')
    expect(formatTimeRange('16:00', '17:30', 'ar')).toMatch(/^4:00 [^\d\s]+ – 5:30 [^\d\s]+$/)
  })
})

describe('relative time', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0) // 19 Oct 2026, 12:00 local

  it('reads "now" for the last moments, and a slightly future time (clock skew) too', () => {
    expect(formatTimeAgo(new Date(2026, 9, 19, 11, 59, 30), now, 'en')).toBe('now')
    expect(formatTimeAgo(new Date(2026, 9, 19, 12, 0, 20), now, 'en')).toBe('now')
  })

  it('counts minutes, hours and days in English', () => {
    expect(formatTimeAgo(new Date(2026, 9, 19, 11, 55), now, 'en')).toBe('5 minutes ago')
    expect(formatTimeAgo(new Date(2026, 9, 19, 11, 59), now, 'en')).toBe('1 minute ago')
    expect(formatTimeAgo(new Date(2026, 9, 19, 9, 0), now, 'en')).toBe('3 hours ago')
    expect(formatTimeAgo(new Date(2026, 9, 18, 8, 0), now, 'en')).toBe('yesterday')
    expect(formatTimeAgo(new Date(2026, 9, 15, 8, 0), now, 'en')).toBe('4 days ago')
  })

  it('calls last night "yesterday" even when it was under 24 hours ago', () => {
    expect(formatTimeAgo(new Date(2026, 9, 18, 23, 30), new Date(2026, 9, 19, 8, 0), 'en')).toBe(
      'yesterday',
    )
  })

  it('switches to the date from a week on', () => {
    expect(formatTimeAgo(new Date(2026, 9, 12, 8, 0), now, 'en')).toBe('12/10/2026')
    expect(formatTimeAgo(new Date(2026, 8, 1, 8, 0), now, 'ar')).toBe('01/09/2026')
  })

  it('reads an ISO timestamp', () => {
    expect(
      formatTimeAgo('2026-10-19T09:55:00+00:00', new Date('2026-10-19T10:00:00+00:00'), 'en'),
    ).toBe('5 minutes ago')
  })

  it('gives Arabic words with Latin digits', () => {
    const five = formatTimeAgo(new Date(2026, 9, 19, 11, 55), now, 'ar')
    expect(five).toMatch(/5/)
    expect(five).not.toMatch(/[٠-٩]/)
    expect(five).toMatch(/[؀-ۿ]/)
  })

  it('says "today", "tomorrow" and "in N days" for counting forward', () => {
    expect(formatRelative(0, 'day', 'en')).toBe('today')
    expect(formatRelative(1, 'day', 'en')).toBe('tomorrow')
    expect(formatRelative(5, 'day', 'en')).toBe('in 5 days')
    expect(formatRelative(5, 'day', 'ar')).toMatch(/5/)
  })
})
