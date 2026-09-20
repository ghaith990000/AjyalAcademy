import { z } from 'zod'
import { isValidISODate, todayISO } from '@/lib/dates'

const CPR = /^\d{9}$/
/** Bahrain numbers are 8 digits; allow an optional +973 style prefix and spaces as typed. */
const PHONE = /^\+?\d{8,15}$/
const OLDEST_BIRTH_DATE = '1990-01-01'

// Messages are `players` namespace keys, translated where they are rendered.
export const playerSchema = z
  .object({
    full_name: z.string().trim().min(1, 'form.fullName.required').max(120, 'form.fullName.tooLong'),
    cpr: z.string().trim().regex(CPR, 'form.cpr.invalid'),
    date_of_birth: z.string().superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'form.dob.required' })
      } else if (!isValidISODate(value) || value < OLDEST_BIRTH_DATE) {
        ctx.addIssue({ code: 'custom', message: 'form.dob.invalid' })
      } else if (value >= todayISO()) {
        ctx.addIssue({ code: 'custom', message: 'form.dob.future' })
      }
    }),
    address: z.string().trim().max(200, 'form.address.tooLong'),
    school: z.string().trim().max(120, 'form.school.tooLong'),
    phone: z
      .string()
      .trim()
      .min(1, 'form.phone.required')
      .refine(
        (value) => value === '' || PHONE.test(value.replace(/\s+/g, '')),
        'form.phone.invalid',
      ),
    has_disease: z.boolean(),
    disease_description: z.string().trim().max(500, 'form.diseaseDescription.tooLong'),
    /** Admin only: '' = unassigned. Coaches never send it (the database forces their own id). */
    coach_id: z.string(),
    /** '' = no location; otherwise an active location (the database refuses a switched-off one). */
    location_id: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.has_disease && values.disease_description === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['disease_description'],
        message: 'form.diseaseDescription.required',
      })
    }
  })

export type PlayerFormValues = z.infer<typeof playerSchema>

/** Row shape written to `players` (matches the table's check constraints). */
export interface PlayerInput {
  full_name: string
  cpr: string
  date_of_birth: string
  address: string | null
  school: string | null
  phone: string
  has_disease: boolean
  disease_description: string | null
  location_id: string | null
  coach_id?: string | null
}

const orNull = (value: string) => (value === '' ? null : value)

/**
 * Form values → database row. The description is null when there is no condition (the table
 * requires it), blank optional fields become null, and `coach_id` is only sent when asked for
 * (admins creating a player) — an update must never touch the assignment.
 */
export function toPlayerInput(
  values: PlayerFormValues,
  options: { includeCoach: boolean },
): PlayerInput {
  const input: PlayerInput = {
    full_name: values.full_name,
    cpr: values.cpr,
    date_of_birth: values.date_of_birth,
    address: orNull(values.address),
    school: orNull(values.school),
    phone: values.phone,
    has_disease: values.has_disease,
    disease_description: values.has_disease ? values.disease_description : null,
    location_id: orNull(values.location_id),
  }
  if (options.includeCoach) input.coach_id = orNull(values.coach_id)
  return input
}
