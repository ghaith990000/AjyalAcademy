import { z } from 'zod'
import { parsePercentToBps } from '@/lib/discounts'
import { parseBD } from '@/lib/money'
import { isValidISODate } from '@/lib/dates'
import type { DiscountInput } from './api'

const optionalDate = z
  .string()
  .refine((value) => value === '' || isValidISODate(value), 'form.validFrom.invalid')

// Messages are `discounts` namespace keys, translated where they are rendered.
export const discountSchema = z
  .object({
    name: z.string().trim().min(1, 'form.name.required').max(80, 'form.name.tooLong'),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{2,30}$/, 'form.code.invalid')
      .transform((code) => code.toUpperCase()),
    type: z.enum(['percent', 'fixed']),
    /** Percent: "12.5"; fixed: BD "2.500". Converted by `toDiscountInput`. */
    value: z.string().trim(),
    valid_from: optionalDate,
    valid_to: optionalDate,
    max_uses: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[1-9]\d{0,5}$/.test(value), 'form.maxUses.invalid'),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const valid =
      values.type === 'percent'
        ? parsePercentToBps(values.value) !== null
        : (parseBD(values.value) ?? 0) > 0
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message:
          values.type === 'percent' ? 'form.value.percentInvalid' : 'form.value.fixedInvalid',
      })
    }
    if (values.valid_from && values.valid_to && values.valid_to < values.valid_from) {
      ctx.addIssue({ code: 'custom', path: ['valid_to'], message: 'form.validTo.before' })
    }
  })

export type DiscountFormValues = z.infer<typeof discountSchema>

/** Form values (already validated) → the row to store. */
export function toDiscountInput(values: DiscountFormValues): DiscountInput {
  return {
    name: values.name,
    code: values.code,
    type: values.type,
    value:
      values.type === 'percent'
        ? (parsePercentToBps(values.value) ?? 0)
        : (parseBD(values.value) ?? 0),
    valid_from: values.valid_from || null,
    valid_to: values.valid_to || null,
    max_uses: values.max_uses === '' ? null : Number(values.max_uses),
    active: values.active,
  }
}
