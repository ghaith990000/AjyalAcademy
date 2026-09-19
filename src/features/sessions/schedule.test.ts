import { describe, expect, it } from 'vitest'
import {
  canTakeAttendance,
  findConflicts,
  groupByDate,
  hhmm,
  minutesOf,
  overlaps,
  doneFilter,
  sessionStatus,
  weeklyDates,
} from './schedule'

const slot = (session_date: string, start_time: string, end_time: string) => ({
  session_date,
  start_time,
  end_time,
})

describe('times', () => {
  it('trims Postgres times and measures minutes since midnight', () => {
    expect(hhmm('16:30:00')).toBe('16:30')
    expect(hhmm('16:30')).toBe('16:30')
    expect(minutesOf('16:30:00')).toBe(990)
    expect(minutesOf('00:00')).toBe(0)
  })
})

describe('weeklyDates', () => {
  it('repeats a week apart, across month and year ends', () => {
    expect(weeklyDates('2026-09-19', 1)).toEqual(['2026-09-19'])
    expect(weeklyDates('2026-09-19', 3)).toEqual(['2026-09-19', '2026-09-26', '2026-10-03'])
    expect(weeklyDates('2026-12-25', 3)).toEqual(['2026-12-25', '2027-01-01', '2027-01-08'])
  })
})

describe('overlaps / findConflicts', () => {
  const base = slot('2026-09-19', '16:00', '17:30')

  it('detects partial, contained and identical overlaps', () => {
    expect(overlaps(base, slot('2026-09-19', '17:00', '18:00'))).toBe(true)
    expect(overlaps(base, slot('2026-09-19', '15:00', '16:01'))).toBe(true)
    expect(overlaps(base, slot('2026-09-19', '16:30', '17:00'))).toBe(true)
    expect(overlaps(base, base)).toBe(true)
  })

  it('lets sessions touch at the ends and ignores other days', () => {
    expect(overlaps(base, slot('2026-09-19', '17:30', '18:30'))).toBe(false)
    expect(overlaps(base, slot('2026-09-19', '15:00', '16:00'))).toBe(false)
    expect(overlaps(base, slot('2026-09-20', '16:00', '17:30'))).toBe(false)
  })

  it('compares form times with Postgres times', () => {
    expect(
      overlaps(slot('2026-09-19', '16:00', '17:00'), slot('2026-09-19', '16:30:00', '18:00:00')),
    ).toBe(true)
  })

  it('returns the existing sessions that clash with any of the new ones', () => {
    const existing = [
      { id: 'a', ...slot('2026-09-19', '16:30:00', '17:30:00') },
      { id: 'b', ...slot('2026-09-26', '10:00:00', '11:00:00') },
      { id: 'c', ...slot('2026-10-03', '16:00:00', '17:00:00') },
    ]
    const candidates = [
      slot('2026-09-19', '16:00', '17:00'),
      slot('2026-09-26', '16:00', '17:00'),
      slot('2026-10-03', '16:00', '17:00'),
    ]
    expect(findConflicts(candidates, existing).map((session) => session.id)).toEqual(['a', 'c'])
    expect(findConflicts([], existing)).toEqual([])
  })
})

describe('sessionStatus', () => {
  const now = new Date(2026, 8, 19, 17, 0) // 19 Sep 2026, 17:00 local
  const at = (date: string, start: string, end: string, cancelled_at: string | null = null) => ({
    ...slot(date, start, end),
    cancelled_at,
  })

  it('cancelled wins over the time', () => {
    expect(sessionStatus(at('2026-09-25', '16:00', '17:00', '2026-09-18T10:00:00Z'), now)).toBe(
      'cancelled',
    )
  })

  it('is upcoming on later days and done on earlier ones', () => {
    expect(sessionStatus(at('2026-09-20', '08:00', '09:00'), now)).toBe('upcoming')
    expect(sessionStatus(at('2026-09-18', '18:00', '19:00'), now)).toBe('done')
  })

  it('today: upcoming until the end time passes, so a session in progress is still open', () => {
    expect(sessionStatus(at('2026-09-19', '18:00', '19:00'), now)).toBe('upcoming')
    expect(sessionStatus(at('2026-09-19', '16:30', '17:30'), now)).toBe('upcoming')
    expect(sessionStatus(at('2026-09-19', '16:00', '17:00'), now)).toBe('done')
    expect(sessionStatus(at('2026-09-19', '10:00:00', '11:00:00'), now)).toBe('done')
  })
})

describe('canTakeAttendance', () => {
  const now = new Date(2026, 8, 19, 9, 0) // 19 Sep 2026, 09:00 local
  const on = (session_date: string, cancelled_at: string | null = null) => ({
    session_date,
    cancelled_at,
  })

  it("is open from the session's day on, whatever the time of day", () => {
    expect(canTakeAttendance(on('2026-09-19'), now)).toBe(true) // today, even before it starts
    expect(canTakeAttendance(on('2026-09-18'), now)).toBe(true)
    expect(canTakeAttendance(on('2020-01-01'), now)).toBe(true)
  })

  it('is closed for a session dated tomorrow or later', () => {
    expect(canTakeAttendance(on('2026-09-20'), now)).toBe(false)
    expect(canTakeAttendance(on('2099-01-05'), now)).toBe(false)
  })

  it('is closed for a cancelled session, whatever its date', () => {
    expect(canTakeAttendance(on('2026-09-18', '2026-09-17T10:00:00Z'), now)).toBe(false)
  })
})

describe('doneFilter', () => {
  it('builds the PostgREST expression from the same rule as sessionStatus', () => {
    expect(doneFilter(new Date(2026, 8, 19, 17, 5))).toBe(
      'session_date.lt.2026-09-19,and(session_date.eq.2026-09-19,end_time.lte.17:05:00)',
    )
  })
})

describe('groupByDate', () => {
  it('groups consecutive rows of the same day and keeps the order', () => {
    const rows = [
      { id: 1, session_date: '2026-09-19' },
      { id: 2, session_date: '2026-09-19' },
      { id: 3, session_date: '2026-09-21' },
      { id: 4, session_date: '2026-09-19' },
    ]
    expect(groupByDate(rows).map((g) => [g.date, g.sessions.map((s) => s.id)])).toEqual([
      ['2026-09-19', [1, 2]],
      ['2026-09-21', [3]],
      ['2026-09-19', [4]],
    ])
    expect(groupByDate([])).toEqual([])
  })
})
