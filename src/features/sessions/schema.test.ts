import { describe, expect, it } from 'vitest'
import { sessionDates, sessionSchema, toSessionInputs, type SessionFormValues } from './schema'

const valid: SessionFormValues = {
  session_date: '2026-09-19',
  start_time: '16:00',
  end_time: '17:30',
  coach_id: 'coach-1',
  location_id: 'loc-1',
  notes: '',
  repeat: false,
  repeat_weeks: '4',
}

const messages = (values: Partial<SessionFormValues>) => {
  const result = sessionSchema.safeParse({ ...valid, ...values })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('sessionSchema', () => {
  it('accepts a valid session', () => {
    expect(sessionSchema.safeParse(valid).success).toBe(true)
  })

  it('needs the end to be after the start', () => {
    expect(messages({ start_time: '17:00', end_time: '16:00' })).toEqual([
      'form.endTime.afterStart',
    ])
    expect(messages({ start_time: '17:00', end_time: '17:00' })).toEqual([
      'form.endTime.afterStart',
    ])
    expect(messages({ start_time: '16:00', end_time: '16:01' })).toEqual([])
  })

  it('needs real times', () => {
    expect(messages({ start_time: '' })).toEqual(['form.startTime.required'])
    expect(messages({ end_time: '25:00' })).toEqual(['form.endTime.required'])
    expect(messages({ end_time: '4:30 PM' })).toEqual(['form.endTime.required'])
  })

  it('needs a real date', () => {
    expect(messages({ session_date: '' })).toEqual(['form.date.required'])
    expect(messages({ session_date: '2026-02-31' })).toEqual(['form.date.invalid'])
  })

  it('needs a coach', () => {
    expect(messages({ coach_id: '' })).toEqual(['form.coach.required'])
  })

  it('needs a location', () => {
    expect(messages({ location_id: '' })).toEqual(['form.location.required'])
  })

  it('limits the free text', () => {
    expect(messages({ notes: 'x'.repeat(501) })).toEqual(['form.notes.tooLong'])
  })

  it('checks the number of weeks only when repeating', () => {
    expect(messages({ repeat: false, repeat_weeks: 'abc' })).toEqual([])
    for (const weeks of ['', 'abc', '1', '27', '2.5', '-3']) {
      expect(messages({ repeat: true, repeat_weeks: weeks }), weeks).toEqual([
        'form.repeatWeeks.invalid',
      ])
    }
    for (const weeks of ['2', '4', '26']) {
      expect(messages({ repeat: true, repeat_weeks: weeks }), weeks).toEqual([])
    }
  })
})

describe('toSessionInputs', () => {
  it('makes one row with the chosen location, turning blank notes into null', () => {
    expect(toSessionInputs(valid)).toEqual([
      {
        session_date: '2026-09-19',
        start_time: '16:00',
        end_time: '17:30',
        coach_id: 'coach-1',
        location_id: 'loc-1',
        notes: null,
      },
    ])
  })

  it('makes one row a week when repeating, N in total including the first', () => {
    const rows = toSessionInputs({
      ...valid,
      repeat: true,
      repeat_weeks: '3',
      location_id: 'loc-2',
      notes: 'Bring bibs',
    })
    expect(rows.map((row) => row.session_date)).toEqual(['2026-09-19', '2026-09-26', '2026-10-03'])
    expect(rows.every((row) => row.location_id === 'loc-2' && row.notes === 'Bring bibs')).toBe(
      true,
    )
    expect(sessionDates({ ...valid, repeat: true, repeat_weeks: '2' })).toHaveLength(2)
  })
})
