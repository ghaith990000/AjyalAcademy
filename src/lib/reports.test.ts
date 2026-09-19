import { describe, expect, it } from 'vitest'
import {
  CSV_BOM,
  csvCell,
  csvFileName,
  currentPeriod,
  formatMargin,
  isLatestPeriod,
  marginBps,
  periodKey,
  periodRange,
  sharePercent,
  shiftPeriod,
  switchKind,
  toCsv,
} from './reports'

describe('marginBps', () => {
  it('matches the worked example: profit 330 of 540 collected is 61.11%', () => {
    expect(marginBps(330_000, 540_000)).toBe(6111)
  })

  it('has no margin when nothing was collected', () => {
    expect(marginBps(0, 0)).toBeNull()
    expect(marginBps(-20_000, 0)).toBeNull()
  })

  it('is negative when the academy lost money', () => {
    expect(marginBps(-15_000, 10_000)).toBe(-15_000)
    expect(marginBps(-150_000, 540_000)).toBe(-2778)
  })

  it('is exactly 100% when there were no expenses', () => {
    expect(marginBps(540_000, 540_000)).toBe(10_000)
  })

  it('rounds half away from zero, like the database', () => {
    expect(marginBps(1, 20_000)).toBe(1) //  0.5 → 1
    expect(marginBps(-1, 20_000)).toBe(-1) // -0.5 → -1 (Math.round would give -0)
    expect(marginBps(1, 30_000)).toBe(0) //  0.33 → 0
  })

  it('agrees with the database for the year in its test fixtures', () => {
    expect(marginBps(360_000, 820_000)).toBe(4390)
    expect(marginBps(30_000, 70_000)).toBe(4286)
  })
})

describe('formatMargin', () => {
  it('shows two decimals with Latin digits and the language’s percent sign', () => {
    expect(formatMargin(6111, 'en')).toBe('61.11%')
    expect(formatMargin(6111, 'ar')).toBe('61.11٪')
    expect(formatMargin(-15_000, 'en')).toBe('-150.00%')
    expect(formatMargin(0, 'en')).toBe('0.00%')
  })

  it('shows a dash when there is no margin', () => {
    expect(formatMargin(null, 'en')).toBe('—')
    expect(formatMargin(null, 'ar')).toBe('—')
  })
})

describe('sharePercent', () => {
  it('is a whole percent of the total', () => {
    expect(sharePercent(150_000, 210_000)).toBe(71)
    expect(sharePercent(50_000, 210_000)).toBe(24)
    expect(sharePercent(10_000, 210_000)).toBe(5)
  })

  it('is 0 for an empty total', () => {
    expect(sharePercent(0, 0)).toBe(0)
  })
})

describe('periods', () => {
  it('starts on the current month or year', () => {
    const now = new Date(2026, 8, 19)
    expect(currentPeriod('month', now)).toEqual({ kind: 'month', year: 2026, month: 9 })
    expect(currentPeriod('year', now)).toEqual({ kind: 'year', year: 2026 })
  })

  it('spans the whole calendar month, leap days included', () => {
    expect(periodRange({ kind: 'month', year: 2025, month: 10 })).toEqual({
      from: '2025-10-01',
      to: '2025-10-31',
    })
    expect(periodRange({ kind: 'month', year: 2025, month: 9 })).toEqual({
      from: '2025-09-01',
      to: '2025-09-30',
    })
    expect(periodRange({ kind: 'month', year: 2025, month: 2 })).toEqual({
      from: '2025-02-01',
      to: '2025-02-28',
    })
    expect(periodRange({ kind: 'month', year: 2024, month: 2 })).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
    expect(periodRange({ kind: 'month', year: 2025, month: 12 })).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('spans the whole calendar year', () => {
    expect(periodRange({ kind: 'year', year: 2025 })).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })

  it('steps months across the year boundary', () => {
    expect(shiftPeriod({ kind: 'month', year: 2026, month: 1 }, -1)).toEqual({
      kind: 'month',
      year: 2025,
      month: 12,
    })
    expect(shiftPeriod({ kind: 'month', year: 2025, month: 12 }, 1)).toEqual({
      kind: 'month',
      year: 2026,
      month: 1,
    })
    expect(shiftPeriod({ kind: 'month', year: 2026, month: 5 }, 1)).toEqual({
      kind: 'month',
      year: 2026,
      month: 6,
    })
  })

  it('steps years', () => {
    expect(shiftPeriod({ kind: 'year', year: 2026 }, -1)).toEqual({ kind: 'year', year: 2025 })
  })

  it('switches between month and year without landing in the future', () => {
    const now = new Date(2026, 8, 19)
    expect(switchKind({ kind: 'month', year: 2026, month: 3 }, 'year', now)).toEqual({
      kind: 'year',
      year: 2026,
    })
    expect(switchKind({ kind: 'year', year: 2026 }, 'month', now)).toEqual({
      kind: 'month',
      year: 2026,
      month: 9,
    })
    expect(switchKind({ kind: 'year', year: 2025 }, 'month', now)).toEqual({
      kind: 'month',
      year: 2025,
      month: 12,
    })
    expect(switchKind({ kind: 'year', year: 2027 }, 'month', now)).toEqual({
      kind: 'month',
      year: 2027,
      month: 1,
    })
    const same = { kind: 'year', year: 2026 } as const
    expect(switchKind(same, 'year', now)).toBe(same)
  })

  it('knows when there is nothing after the period', () => {
    const now = new Date(2026, 8, 19)
    expect(isLatestPeriod({ kind: 'month', year: 2026, month: 9 }, now)).toBe(true)
    expect(isLatestPeriod({ kind: 'month', year: 2026, month: 8 }, now)).toBe(false)
    expect(isLatestPeriod({ kind: 'year', year: 2026 }, now)).toBe(true)
    expect(isLatestPeriod({ kind: 'year', year: 2025 }, now)).toBe(false)
    // the 1st of the next month is not "today" yet, even on the last day of this one
    expect(isLatestPeriod({ kind: 'month', year: 2026, month: 9 }, new Date(2026, 8, 30))).toBe(
      true,
    )
    expect(isLatestPeriod({ kind: 'month', year: 2026, month: 9 }, new Date(2026, 9, 1))).toBe(
      false,
    )
  })

  it('has a stable key', () => {
    expect(periodKey({ kind: 'month', year: 2026, month: 9 })).toBe('2026-09')
    expect(periodKey({ kind: 'year', year: 2026 })).toBe('2026')
  })
})

describe('csv', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvCell('Ali')).toBe('Ali')
    expect(csvCell('540.000')).toBe('540.000')
    expect(csvCell(12)).toBe('12')
    expect(csvCell(null)).toBe('')
  })

  it('quotes fields with commas, quotes or line breaks', () => {
    expect(csvCell('Pitch, hall')).toBe('"Pitch, hall"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  it('does not let text run as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-2')).toBe("'-2")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('keeps Arabic text as it is', () => {
    expect(csvCell('محمد علي')).toBe('محمد علي')
  })

  it('joins rows with CRLF and ends with a line break', () => {
    expect(
      toCsv([
        ['Date', 'Amount'],
        ['2025-10-01', '200.000'],
      ]),
    ).toBe('Date,Amount\r\n2025-10-01,200.000\r\n')
  })

  it('names files after the kind and the period', () => {
    expect(csvFileName('payments', { kind: 'month', year: 2026, month: 10 })).toBe(
      'ajyal-payments-2026-10.csv',
    )
    expect(csvFileName('expenses', { kind: 'year', year: 2026 })).toBe('ajyal-expenses-2026.csv')
  })

  it('has the byte-order mark Excel needs for UTF-8', () => {
    expect(CSV_BOM).toHaveLength(1)
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff)
  })
})
