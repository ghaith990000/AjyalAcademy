import { describe, expect, it } from 'vitest'
import {
  attendanceRate,
  countMarks,
  flip,
  hasChanges,
  initialMarks,
  markAll,
  toRecords,
} from './marks'

const roster = ['a', 'b', 'c']

describe('initialMarks', () => {
  it('starts everyone absent when nothing is saved', () => {
    expect(initialMarks(roster, [])).toEqual({ a: 'absent', b: 'absent', c: 'absent' })
  })

  it('uses what was saved and ignores players who left the roster', () => {
    const saved = [
      { player_id: 'a', status: 'present' as const },
      { player_id: 'gone', status: 'present' as const },
    ]
    expect(initialMarks(roster, saved)).toEqual({ a: 'present', b: 'absent', c: 'absent' })
  })
})

describe('toggling and marking everyone', () => {
  it('flips one mark', () => {
    expect(flip('present')).toBe('absent')
    expect(flip('absent')).toBe('present')
  })

  it('marks the whole roster present or absent', () => {
    expect(markAll(roster, 'present')).toEqual({ a: 'present', b: 'present', c: 'present' })
    expect(markAll(roster, 'absent')).toEqual({ a: 'absent', b: 'absent', c: 'absent' })
    expect(markAll([], 'present')).toEqual({})
  })
})

describe('countMarks', () => {
  it('counts live from the marks', () => {
    expect(countMarks(roster, { a: 'present', b: 'absent', c: 'present' })).toEqual({
      present: 2,
      absent: 1,
      total: 3,
    })
    expect(countMarks([], {})).toEqual({ present: 0, absent: 0, total: 0 })
  })

  it('counts only rostered players', () => {
    expect(countMarks(['a'], { a: 'present', stranger: 'present' })).toEqual({
      present: 1,
      absent: 0,
      total: 1,
    })
  })
})

describe('toRecords', () => {
  it('sends every rostered player, absent when unmarked', () => {
    expect(toRecords(roster, { a: 'present', b: 'absent' })).toEqual([
      { player_id: 'a', status: 'present' },
      { player_id: 'b', status: 'absent' },
      { player_id: 'c', status: 'absent' },
    ])
  })
})

describe('hasChanges', () => {
  const saved = [{ player_id: 'a', status: 'present' as const }]

  it('is false while the screen equals what is saved', () => {
    expect(hasChanges(roster, initialMarks(roster, saved), saved)).toBe(false)
    expect(hasChanges(roster, initialMarks(roster, []), [])).toBe(false)
  })

  it('is true after any toggle, and false again when it is toggled back', () => {
    const changed = { ...initialMarks(roster, saved), b: 'present' as const }
    expect(hasChanges(roster, changed, saved)).toBe(true)
    expect(hasChanges(roster, { ...changed, b: 'absent' }, saved)).toBe(false)
  })
})

describe('attendanceRate', () => {
  it('is a whole percent, rounded half up', () => {
    expect(attendanceRate(17, 20)).toBe(85)
    expect(attendanceRate(1, 3)).toBe(33)
    expect(attendanceRate(2, 3)).toBe(67)
    expect(attendanceRate(1, 8)).toBe(13) // 12.5 → 13
    expect(attendanceRate(0, 5)).toBe(0)
    expect(attendanceRate(5, 5)).toBe(100)
  })

  it('is null when there is nothing to divide by', () => {
    expect(attendanceRate(0, 0)).toBeNull()
  })
})
