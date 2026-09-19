import { describe, expect, it } from 'vitest'
import type { Plan, Settings } from '@/features/settings/api'
import { fakePlayer } from '@/test/players'
import type { Discount } from './api'
import {
  buildParams,
  checkDiscount,
  computePricing,
  initialDraft,
  paymentAmount,
  planFor,
  tshirtApplies,
  validateStep,
  withEnd,
  withPlayerToggled,
  withStart,
  type Draft,
  type DraftContext,
} from './draft'

const TODAY = '2026-10-01'

// Placeholder prices/fees from docs/05-business-rules.md, passed explicitly.
const plans: Plan[] = [
  { id: 'plan-solo', code: 'solo', player_count: 1, price_fils: 20000, active: true },
  { id: 'plan-duo', code: 'duo', player_count: 2, price_fils: 35000, active: true },
  { id: 'plan-trio', code: 'trio', player_count: 3, price_fils: 50000, active: true },
  { id: 'plan-quad', code: 'quad', player_count: 4, price_fils: 60000, active: true },
]
const settings: Settings = {
  id: true,
  tshirt_fee_fils: 5000,
  transport_fee_fils: 10000,
  expiring_soon_days: 7,
}
const discount = (overrides: Partial<Discount>): Discount => ({
  id: 'd1',
  name: 'Ten',
  code: 'TEN',
  type: 'percent',
  value: 1000,
  valid_from: null,
  valid_to: null,
  max_uses: null,
  active: true,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const A = fakePlayer({ id: 'a', full_name: 'A' })
const B = fakePlayer({ id: 'b', full_name: 'B' })
const C = fakePlayer({ id: 'c', full_name: 'C' })
const D = fakePlayer({ id: 'd', full_name: 'D' })
const E = fakePlayer({ id: 'e', full_name: 'E' })

const ctx = (overrides: Partial<DraftContext> = {}): DraftContext => ({
  plans,
  settings,
  returning: new Set(),
  isAdmin: false,
  discounts: [discount({})],
  today: TODAY,
  ...overrides,
})
const draftWith = (players: (typeof A)[], overrides: Partial<Draft> = {}): Draft => ({
  ...initialDraft(TODAY),
  players,
  ...overrides,
})

describe('period', () => {
  it('starts today and ends one month minus a day later', () => {
    const draft = initialDraft('2026-10-01')
    expect([draft.start, draft.end]).toEqual(['2026-10-01', '2026-10-31'])
  })

  it('moves the end with the start until the user edits the end themselves', () => {
    let draft = withStart(initialDraft(TODAY), '2026-10-15')
    expect(draft.end).toBe('2026-11-14')
    draft = withEnd(draft, '2026-12-31')
    draft = withStart(draft, '2026-10-20')
    expect(draft.end).toBe('2026-12-31')
  })

  it('ignores a half-typed start date', () => {
    expect(withStart(initialDraft(TODAY), '2026-1').end).toBe('2026-10-31')
  })
})

describe('choosing players', () => {
  it('adds and removes players, and never exceeds four', () => {
    let draft = initialDraft(TODAY)
    for (const player of [A, B, C, D, E]) draft = withPlayerToggled(draft, player)
    expect(draft.players.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    draft = withPlayerToggled(draft, B)
    expect(draft.players.map((p) => p.id)).toEqual(['a', 'c', 'd'])
  })

  it('forgets the options of a removed player', () => {
    let draft = draftWith([A, B], { transport: { a: true, b: true }, tshirt: { b: false } })
    draft = withPlayerToggled(draft, B)
    expect(draft.transport).toEqual({ a: true })
    expect(draft.tshirt).toEqual({})
  })

  it('picks the plan from the number of players', () => {
    expect(
      [1, 2, 3, 4].map((n) => planFor(draftWith([A, B, C, D].slice(0, n)), ctx())?.code),
    ).toEqual(['solo', 'duo', 'trio', 'quad'])
    expect(planFor(draftWith([]), ctx())).toBeUndefined()
  })

  it('does not offer an inactive plan', () => {
    const inactive = plans.map((p) => (p.code === 'duo' ? { ...p, active: false } : p))
    expect(planFor(draftWith([A, B]), ctx({ plans: inactive }))).toBeUndefined()
    expect(validateStep('players', draftWith([A, B]), ctx({ plans: inactive }))).toBe(
      'plan_unavailable',
    )
  })
})

describe('T-shirt fee', () => {
  it('applies to first-timers only', () => {
    const c = ctx({ returning: new Set(['b']) })
    expect(tshirtApplies(draftWith([A, B]), 'a', c)).toBe(true)
    expect(tshirtApplies(draftWith([A, B]), 'b', c)).toBe(false)
  })

  it('can be overridden by an admin but not by a coach', () => {
    const draft = draftWith([A, B], { tshirt: { a: false, b: true } })
    const returning = new Set(['b'])
    const admin = ctx({ isAdmin: true, returning })
    expect([tshirtApplies(draft, 'a', admin), tshirtApplies(draft, 'b', admin)]).toEqual([
      false,
      true,
    ])
    const coach = ctx({ isAdmin: false, returning })
    expect([tshirtApplies(draft, 'a', coach), tshirtApplies(draft, 'b', coach)]).toEqual([
      true,
      false,
    ])
  })
})

describe('live price — the worked examples', () => {
  it('#2 solo, first-time', () => {
    expect(computePricing(draftWith([A]), ctx())?.totalFils).toBe(25000)
  })

  it('#1 solo, returning', () => {
    expect(computePricing(draftWith([A]), ctx({ returning: new Set(['a']) }))?.totalFils).toBe(
      20000,
    )
  })

  it('#3 duo: A first-time with transport, B returning, 10% code', () => {
    const draft = draftWith([A, B], { transport: { a: true }, discountMode: 'code', code: 'ten' })
    expect(computePricing(draft, ctx({ returning: new Set(['b']) }))).toMatchObject({
      subtotalFils: 50000,
      discountFils: 5000,
      totalFils: 45000,
    })
  })

  it('#4 solo first-time, manual fixed 3.000', () => {
    const draft = draftWith([A], {
      discountMode: 'manual',
      manualType: 'fixed',
      manualValue: '3',
      manualReason: 'Loyalty',
    })
    expect(computePricing(draft, ctx())?.totalFils).toBe(22000)
  })

  it('#5 a fixed discount above the subtotal is capped at zero', () => {
    const draft = draftWith([A], {
      discountMode: 'manual',
      manualType: 'fixed',
      manualValue: '30',
      manualReason: 'Free month',
    })
    expect(computePricing(draft, ctx({ returning: new Set(['a']) }))).toMatchObject({
      discountFils: 20000,
      totalFils: 0,
    })
  })

  it('#6 quad, all returning, two with transport, manual 15%', () => {
    const draft = draftWith([A, B, C, D], {
      transport: { a: true, c: true },
      discountMode: 'manual',
      manualType: 'percent',
      manualValue: '15',
      manualReason: 'Sibling promo',
    })
    const returning = new Set(['a', 'b', 'c', 'd'])
    expect(computePricing(draft, ctx({ returning }))?.totalFils).toBe(68000)
  })

  it('#7 rounding: 12.5% of 35.000', () => {
    const draft = draftWith([A], {
      transport: { a: true },
      discountMode: 'manual',
      manualType: 'percent',
      manualValue: '12.5',
      manualReason: 'Staff child',
    })
    expect(computePricing(draft, ctx())).toMatchObject({ discountFils: 4375, totalFils: 30625 })
  })

  it('is null until there is a plan and the settings have loaded', () => {
    expect(computePricing(draftWith([]), ctx())).toBeNull()
    expect(computePricing(draftWith([A]), ctx({ settings: undefined }))).toBeNull()
  })

  it('ignores an invalid discount in the preview (the step blocks it)', () => {
    const draft = draftWith([A], { discountMode: 'code', code: 'NOPE' })
    expect(computePricing(draft, ctx())?.discountFils).toBe(0)
  })
})

describe('discount checks', () => {
  const check = (overrides: Partial<Draft>, c = ctx()) =>
    checkDiscount(draftWith([A], overrides), c)

  it('is none by default', () => {
    expect(check({})).toEqual({ kind: 'none' })
  })

  it('finds a code case-insensitively and ignoring spaces', () => {
    expect(check({ discountMode: 'code', code: '  ten ' })).toMatchObject({ kind: 'ok' })
  })

  it('reports a missing, unknown, not-yet-valid or expired code', () => {
    expect(check({ discountMode: 'code', code: '' })).toEqual({
      kind: 'error',
      error: 'code_required',
    })
    expect(check({ discountMode: 'code', code: 'x' })).toEqual({
      kind: 'error',
      error: 'code_not_found',
    })
    const future = ctx({ discounts: [discount({ valid_from: '2026-10-02' })] })
    expect(check({ discountMode: 'code', code: 'TEN' }, future)).toEqual({
      kind: 'error',
      error: 'code_not_started',
    })
    const past = ctx({ discounts: [discount({ valid_to: '2026-09-30' })] })
    expect(check({ discountMode: 'code', code: 'TEN' }, past)).toEqual({
      kind: 'error',
      error: 'code_expired',
    })
  })

  it('accepts a code on its first and last valid day', () => {
    const c = ctx({ discounts: [discount({ valid_from: TODAY, valid_to: TODAY })] })
    expect(check({ discountMode: 'code', code: 'TEN' }, c)).toMatchObject({ kind: 'ok' })
  })

  it('needs a reason and a valid value for a manual discount', () => {
    const manual = { discountMode: 'manual' as const, manualType: 'percent' as const }
    expect(check({ ...manual, manualValue: '10', manualReason: '  ' })).toEqual({
      kind: 'error',
      error: 'reason_required',
    })
    expect(check({ ...manual, manualValue: '0', manualReason: 'r' })).toEqual({
      kind: 'error',
      error: 'value_invalid',
    })
    expect(check({ ...manual, manualValue: '101', manualReason: 'r' })).toEqual({
      kind: 'error',
      error: 'value_invalid',
    })
    expect(check({ ...manual, manualType: 'fixed', manualValue: '0', manualReason: 'r' })).toEqual({
      kind: 'error',
      error: 'value_invalid',
    })
    expect(check({ ...manual, manualValue: '10', manualReason: ' Staff ' })).toMatchObject({
      kind: 'ok',
      reason: 'Staff',
    })
  })
})

describe('payment', () => {
  it('records the whole total by default, nothing when unpaid or when the total is zero', () => {
    expect(paymentAmount(draftWith([A]), 25000)).toBe(25000)
    expect(paymentAmount(draftWith([A], { payMode: 'unpaid' }), 25000)).toBe(0)
    expect(paymentAmount(draftWith([A]), 0)).toBe(0)
  })

  it('accepts a partial amount from 0.001 up to the total, and rejects the rest', () => {
    const partial = (payAmount: string) =>
      paymentAmount(draftWith([A], { payMode: 'partial', payAmount }), 25000)
    expect(partial('10')).toBe(10000)
    expect(partial('25')).toBe(25000)
    expect(partial('0.001')).toBe(1)
    for (const bad of ['', '0', '25.001', 'abc', '-5']) expect(partial(bad), bad).toBeNull()
  })
})

describe('step validation', () => {
  it('needs players, valid dates in order, a valid discount and a valid payment', () => {
    expect(validateStep('players', draftWith([]), ctx())).toBe('no_players')
    expect(validateStep('players', draftWith([A]), ctx())).toBeNull()
    expect(validateStep('dates', draftWith([A], { start: '2026-1-1' }), ctx())).toBe(
      'start_invalid',
    )
    expect(validateStep('dates', draftWith([A], { end: '' }), ctx())).toBe('end_invalid')
    expect(
      validateStep('dates', draftWith([A], { start: '2026-10-05', end: '2026-10-04' }), ctx()),
    ).toBe('end_before_start')
    expect(
      validateStep('dates', draftWith([A], { start: '2026-10-05', end: '2026-10-05' }), ctx()),
    ).toBeNull()
    expect(
      validateStep('discount', draftWith([A], { discountMode: 'code', code: 'x' }), ctx()),
    ).toBe('code_not_found')
    expect(
      validateStep('payment', draftWith([A], { payMode: 'partial', payAmount: '99' }), ctx()),
    ).toBe('amount_invalid')
    expect(validateStep('options', draftWith([A]), ctx())).toBeNull()
    expect(validateStep('summary', draftWith([A]), ctx())).toBeNull()
  })
})

describe('buildParams (arguments for create_subscription)', () => {
  it('sends a plain unpaid-by-default solo subscription for a coach with no overrides', () => {
    const draft = draftWith([A], { start: '2026-10-01', end: '2026-10-31', tshirt: { a: false } })
    expect(buildParams(draft, ctx())).toEqual({
      p_start_date: '2026-10-01',
      p_end_date: '2026-10-31',
      p_players: [{ player_id: 'a', transport: false }],
      p_initial_payment_fils: 25000,
      p_payment_method: 'cash',
    })
  })

  it("sends an admin's explicit T-shirt choice and transport", () => {
    const draft = draftWith([A, B], { transport: { b: true }, tshirt: { a: false } })
    const params = buildParams(draft, ctx({ isAdmin: true }))
    expect(params.p_players).toEqual([
      { player_id: 'a', transport: false, tshirt: false },
      { player_id: 'b', transport: true },
    ])
  })

  it('sends the code (not a manual discount) when a code is applied', () => {
    const draft = draftWith([A], { discountMode: 'code', code: ' ten ', payMode: 'unpaid' })
    const params = buildParams(draft, ctx())
    expect(params).toMatchObject({ p_discount_code: 'TEN' })
    expect(params).not.toHaveProperty('p_manual_discount_type')
    expect(params).not.toHaveProperty('p_initial_payment_fils')
  })

  it('sends a manual discount as basis points / fils with its reason', () => {
    const percent = draftWith([A], {
      discountMode: 'manual',
      manualType: 'percent',
      manualValue: '12.5',
      manualReason: ' Staff child ',
      payMode: 'partial',
      payAmount: '10',
      method: 'benefit',
    })
    expect(buildParams(percent, ctx())).toMatchObject({
      p_manual_discount_type: 'percent',
      p_manual_discount_value: 1250,
      p_manual_discount_reason: 'Staff child',
      p_initial_payment_fils: 10000,
      p_payment_method: 'benefit',
    })
    const fixed = draftWith([A], {
      discountMode: 'manual',
      manualType: 'fixed',
      manualValue: '3',
      manualReason: 'Loyalty',
    })
    expect(buildParams(fixed, ctx())).toMatchObject({
      p_manual_discount_type: 'fixed',
      p_manual_discount_value: 3000,
    })
  })

  it('omits the payment for a zero total', () => {
    const draft = draftWith([A], {
      discountMode: 'manual',
      manualType: 'fixed',
      manualValue: '30',
      manualReason: 'Free',
    })
    expect(buildParams(draft, ctx({ returning: new Set(['a']) }))).not.toHaveProperty(
      'p_initial_payment_fils',
    )
  })
})
