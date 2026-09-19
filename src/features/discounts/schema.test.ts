import { describe, expect, it } from 'vitest'
import { discountSchema, toDiscountInput, type DiscountFormValues } from './schema'

const valid: DiscountFormValues = {
  name: 'Sibling discount',
  code: 'sibling10',
  type: 'percent',
  value: '10',
  valid_from: '',
  valid_to: '',
  max_uses: '',
  active: true,
}

function issues(values: Partial<DiscountFormValues>): Record<string, string> {
  const result = discountSchema.safeParse({ ...valid, ...values })
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('discountSchema', () => {
  it('accepts a complete percent discount and upper-cases the code', () => {
    const result = discountSchema.parse(valid)
    expect(result.code).toBe('SIBLING10')
  })

  it.each(['A', 'has space', 'x'.repeat(31), 'ünï', ''])('rejects the code "%s"', (code) => {
    expect(issues({ code }).code).toBe('form.code.invalid')
  })

  it('validates the value according to the type', () => {
    expect(issues({ type: 'percent', value: '0' }).value).toBe('form.value.percentInvalid')
    expect(issues({ type: 'percent', value: '101' }).value).toBe('form.value.percentInvalid')
    expect(issues({ type: 'fixed', value: '0' }).value).toBe('form.value.fixedInvalid')
    expect(issues({ type: 'fixed', value: 'abc' }).value).toBe('form.value.fixedInvalid')
    expect(issues({ type: 'fixed', value: '2.5' })).toEqual({})
  })

  it('requires the end date not to precede the start date', () => {
    expect(issues({ valid_from: '2026-10-10', valid_to: '2026-10-09' }).valid_to).toBe(
      'form.validTo.before',
    )
    expect(issues({ valid_from: '2026-10-10', valid_to: '2026-10-10' })).toEqual({})
  })

  it('accepts only a positive whole number for max uses (or blank)', () => {
    expect(issues({ max_uses: '' })).toEqual({})
    expect(issues({ max_uses: '5' })).toEqual({})
    for (const bad of ['0', '-1', '1.5', 'x']) {
      expect(issues({ max_uses: bad }).max_uses, bad).toBe('form.maxUses.invalid')
    }
  })
})

describe('toDiscountInput', () => {
  it('stores percent as basis points and blanks as null', () => {
    expect(toDiscountInput(discountSchema.parse({ ...valid, value: '12.5' }))).toEqual({
      name: 'Sibling discount',
      code: 'SIBLING10',
      type: 'percent',
      value: 1250,
      valid_from: null,
      valid_to: null,
      max_uses: null,
      active: true,
    })
  })

  it('stores fixed amounts as fils, with dates and a use limit', () => {
    const input = toDiscountInput(
      discountSchema.parse({
        ...valid,
        type: 'fixed',
        value: '2.5',
        valid_from: '2026-10-01',
        valid_to: '2026-10-31',
        max_uses: '20',
        active: false,
      }),
    )
    expect(input).toMatchObject({
      type: 'fixed',
      value: 2500,
      valid_from: '2026-10-01',
      valid_to: '2026-10-31',
      max_uses: 20,
      active: false,
    })
  })
})
