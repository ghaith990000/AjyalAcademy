import { z } from 'zod'

const MAX_SALARY_BD = 10_000 // matches the create-coach function (10,000,000 fils)

// Messages are `coaches` namespace keys, translated where they are rendered.
const details = z.object({
  full_name: z.string().trim().min(1, 'form.fullName.required').max(120, 'form.fullName.tooLong'),
  phone: z.string().trim().max(30, 'form.phone.tooLong'),
  /** Typed in BD ("250" or "250.500"); converted to integer fils on submit with `fromBD`. */
  salary: z
    .string()
    .trim()
    .regex(/^\d{1,6}([.,]\d{1,3})?$/, 'form.salary.invalid')
    .refine((value) => Number(value.replace(',', '.')) <= MAX_SALARY_BD, 'form.salary.tooHigh'),
})

export const createCoachSchema = details.extend({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'form.email.required')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'form.email.invalid'),
  password: z
    .string()
    .min(1, 'form.password.required')
    .min(8, 'form.password.tooShort')
    .max(72, 'form.password.tooLong'),
})

export const editCoachSchema = details.extend({ active: z.boolean() })

export type CreateCoachValues = z.infer<typeof createCoachSchema>
export type EditCoachValues = z.infer<typeof editCoachSchema>
