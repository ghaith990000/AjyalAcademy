import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expenseSchema, toExpenseInput, MAX_EXPENSE_FILS } from './schema'

const valid = {
  category: 'field_rent',
  amount: '50',
  expense_date: '2026-09-10',
  coach_id: '',
  description: '',
}

const messagesOf = (input: unknown) => {
  const result = expenseSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('expenseSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 19, 12))
  })
  afterEach(() => vi.useRealTimers())

  it('accepts a plain expense', () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true)
  })

  it('needs an amount above zero, in BD with up to three decimals', () => {
    for (const amount of ['', '0', '0.000', 'abc', '-5', '12.3456']) {
      expect(messagesOf({ ...valid, amount }), amount).toContain('form.amount.invalid')
    }
    for (const amount of ['1', '12.5', '12,500', '0.001']) {
      expect(messagesOf({ ...valid, amount }), amount).toEqual([])
    }
  })

  it('caps the amount at a sanity ceiling', () => {
    expect(MAX_EXPENSE_FILS).toBe(100_000_000)
    expect(messagesOf({ ...valid, amount: '100000' })).toEqual([])
    expect(messagesOf({ ...valid, amount: '100000.001' })).toContain('form.amount.tooHigh')
  })

  it('needs a real date that is not in the future', () => {
    expect(messagesOf({ ...valid, expense_date: '' })).toContain('form.date.invalid')
    expect(messagesOf({ ...valid, expense_date: '2026-02-31' })).toContain('form.date.invalid')
    expect(messagesOf({ ...valid, expense_date: '2026-09-19' })).toEqual([])
    expect(messagesOf({ ...valid, expense_date: '2026-09-20' })).toContain('form.date.future')
  })

  it('needs a coach for a salary, and only for a salary', () => {
    expect(messagesOf({ ...valid, category: 'coach_salary' })).toContain('form.coach.required')
    expect(messagesOf({ ...valid, category: 'coach_salary', coach_id: 'c1' })).toEqual([])
    expect(messagesOf({ ...valid, category: 'other', coach_id: '' })).toEqual([])
  })

  it('limits the note to 200 characters', () => {
    expect(messagesOf({ ...valid, description: 'x'.repeat(200) })).toEqual([])
    expect(messagesOf({ ...valid, description: 'x'.repeat(201) })).toContain(
      'form.description.tooLong',
    )
  })
})

describe('toExpenseInput', () => {
  it('converts BD to integer fils and trims the note', () => {
    const values = expenseSchema.parse({ ...valid, amount: '12,5', description: '  Pitch  ' })
    expect(toExpenseInput(values)).toEqual({
      category: 'field_rent',
      amount_fils: 12_500,
      expense_date: '2026-09-10',
      coach_id: null,
      description: 'Pitch',
    })
  })

  it('stores an empty note as null', () => {
    expect(toExpenseInput(expenseSchema.parse(valid)).description).toBeNull()
  })

  it('keeps the coach for a salary and drops a stale one for anything else', () => {
    const salary = expenseSchema.parse({ ...valid, category: 'coach_salary', coach_id: 'c1' })
    expect(toExpenseInput(salary).coach_id).toBe('c1')
    const other = expenseSchema.parse({ ...valid, category: 'equipment', coach_id: 'c1' })
    expect(toExpenseInput(other).coach_id).toBeNull()
  })
})
