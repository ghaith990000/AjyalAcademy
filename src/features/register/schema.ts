import { z } from 'zod'
import { CPR, OLDEST_BIRTH_DATE, PHONE } from '@/features/players/schema'
import { isValidISODate, todayISO } from '@/lib/dates'
import type { ChildInput } from './api'

export const MAX_CHILDREN = 4

// Messages are `register` namespace keys, translated where they are rendered.
const childSchema = z
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
    school: z.string().trim().max(120, 'form.school.tooLong'),
    address: z.string().trim().max(200, 'form.address.tooLong'),
    has_disease: z.boolean(),
    disease_description: z.string().trim().max(500, 'form.diseaseDescription.tooLong'),
  })
  .superRefine((child, ctx) => {
    if (child.has_disease && child.disease_description === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['disease_description'],
        message: 'form.diseaseDescription.required',
      })
    }
  })

/**
 * The public form: one parent, 1–4 children. The location is required only when the academy has some to offer
 * (`locationRequired`); the honeypot `website` is never validated — a bot that fills it is answered with a
 * success by the database and stored nowhere.
 */
export function createRegisterSchema({ locationRequired }: { locationRequired: boolean }) {
  return z
    .object({
      guardian_name: z
        .string()
        .trim()
        .min(1, 'form.guardianName.required')
        .max(120, 'form.guardianName.tooLong'),
      phone: z
        .string()
        .trim()
        .min(1, 'form.phone.required')
        .refine(
          (value) => value === '' || PHONE.test(value.replace(/\s+/g, '')),
          'form.phone.invalid',
        ),
      location_id: z.string().min(locationRequired ? 1 : 0, 'form.location.required'),
      children: z.array(childSchema).min(1).max(MAX_CHILDREN),
      confirm: z.boolean().refine((value) => value, 'form.confirm.required'),
      website: z.string(),
    })
    .superRefine((values, ctx) => {
      // Two children with one CPR is a typing mistake; say which card so it can be fixed.
      const seen = new Set<string>()
      values.children.forEach((child, index) => {
        if (!CPR.test(child.cpr)) return
        if (seen.has(child.cpr)) {
          ctx.addIssue({
            code: 'custom',
            path: ['children', index, 'cpr'],
            message: 'form.cpr.duplicate',
          })
        }
        seen.add(child.cpr)
      })
    })
}

export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>
export type ChildFormValues = RegisterFormValues['children'][number]

export const emptyChild = (): ChildFormValues => ({
  full_name: '',
  cpr: '',
  date_of_birth: '',
  school: '',
  address: '',
  has_disease: false,
  disease_description: '',
})

const orNull = (value: string) => (value === '' ? null : value)

/** Form values → what the database function takes (a description only with a condition; blanks become null). */
export function toChildInput(child: ChildFormValues): ChildInput {
  return {
    full_name: child.full_name,
    cpr: child.cpr,
    date_of_birth: child.date_of_birth,
    address: orNull(child.address),
    school: orNull(child.school),
    has_disease: child.has_disease,
    disease_description: child.has_disease ? child.disease_description : null,
  }
}
