// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateCreateCoach } from '../../supabase/functions/create-coach/validate'

const valid = {
  full_name: ' Khalid Al Dosari ',
  email: ' Coach@Example.COM ',
  password: 'longenough1',
}

describe('validateCreateCoach', () => {
  it('accepts a minimal body, trimming and lowercasing, with sensible defaults', () => {
    const result = validateCreateCoach(valid)
    expect(result).toEqual({
      ok: true,
      value: {
        full_name: 'Khalid Al Dosari',
        email: 'coach@example.com',
        password: 'longenough1',
        phone: null,
        monthly_salary_fils: 0,
        preferred_language: 'ar',
      },
    })
  })

  it('accepts optional fields', () => {
    const result = validateCreateCoach({
      ...valid,
      phone: ' 39006938 ',
      monthly_salary_fils: 250000,
      preferred_language: 'en',
    })
    expect(result).toMatchObject({
      ok: true,
      value: { phone: '39006938', monthly_salary_fils: 250000, preferred_language: 'en' },
    })
  })

  it.each([
    ['body', null],
    ['body', 'text'],
    ['full_name', { ...valid, full_name: '   ' }],
    ['full_name', { ...valid, full_name: 'x'.repeat(121) }],
    ['email', { ...valid, email: 'not-an-email' }],
    ['password', { ...valid, password: 'short' }],
    ['password', { ...valid, password: 'x'.repeat(73) }],
    ['phone', { ...valid, phone: 12345678 }],
    ['monthly_salary_fils', { ...valid, monthly_salary_fils: 1.5 }],
    ['monthly_salary_fils', { ...valid, monthly_salary_fils: -1 }],
    ['monthly_salary_fils', { ...valid, monthly_salary_fils: '250000' }],
    ['preferred_language', { ...valid, preferred_language: 'fr' }],
  ])('rejects invalid %s', (field, body) => {
    expect(validateCreateCoach(body)).toEqual({ ok: false, field })
  })
})
