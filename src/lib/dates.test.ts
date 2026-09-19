import { describe, expect, it } from 'vitest'
import { formatDate, formatLongDate, formatTime } from './dates'

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
