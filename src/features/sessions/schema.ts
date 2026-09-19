import { z } from 'zod'
import { isValidISODate } from '@/lib/dates'
import { weeklyDates } from './schedule'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
export const MIN_REPEAT_WEEKS = 2
export const MAX_REPEAT_WEEKS = 26

// Messages are `sessions` namespace keys, translated where they are rendered.
export const sessionSchema = z
  .object({
    session_date: z.string().superRefine((value, ctx) => {
      if (!value) ctx.addIssue({ code: 'custom', message: 'form.date.required' })
      else if (!isValidISODate(value))
        ctx.addIssue({ code: 'custom', message: 'form.date.invalid' })
    }),
    start_time: z.string().regex(TIME, 'form.startTime.required'),
    end_time: z.string().regex(TIME, 'form.endTime.required'),
    /** Admins pick; a coach's own id is filled in by the form. */
    coach_id: z.string().min(1, 'form.coach.required'),
    location: z.string().trim().max(120, 'form.location.tooLong'),
    notes: z.string().trim().max(500, 'form.notes.tooLong'),
    repeat: z.boolean(),
    /** Typed as text; only read when `repeat` is on. */
    repeat_weeks: z.string(),
  })
  .superRefine((values, ctx) => {
    if (TIME.test(values.start_time) && TIME.test(values.end_time)) {
      // Zero-padded "HH:mm" strings compare correctly as text.
      if (values.end_time <= values.start_time) {
        ctx.addIssue({ code: 'custom', path: ['end_time'], message: 'form.endTime.afterStart' })
      }
    }
    if (values.repeat) {
      const weeks = Number(values.repeat_weeks)
      if (
        values.repeat_weeks.trim() === '' ||
        !Number.isInteger(weeks) ||
        weeks < MIN_REPEAT_WEEKS ||
        weeks > MAX_REPEAT_WEEKS
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['repeat_weeks'],
          message: 'form.repeatWeeks.invalid',
        })
      }
    }
  })

export type SessionFormValues = z.infer<typeof sessionSchema>

/** Row shape written to `training_sessions`. */
export interface SessionInput {
  session_date: string
  start_time: string
  end_time: string
  coach_id: string
  location: string | null
  notes: string | null
}

const orNull = (value: string) => (value === '' ? null : value)

/** The dates a form creates: just the one, or one a week for `repeat_weeks` weeks. */
export function sessionDates(values: SessionFormValues): string[] {
  return values.repeat
    ? weeklyDates(values.session_date, Number(values.repeat_weeks))
    : [values.session_date]
}

/** Form values → the rows to insert (several when repeating weekly). */
export function toSessionInputs(values: SessionFormValues): SessionInput[] {
  return sessionDates(values).map((session_date) => ({
    session_date,
    start_time: values.start_time,
    end_time: values.end_time,
    coach_id: values.coach_id,
    location: orNull(values.location),
    notes: orNull(values.notes),
  }))
}
