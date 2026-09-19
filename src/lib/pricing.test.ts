import { describe, expect, it } from 'vitest'
import {
  calcSubscriptionTotal,
  discountFils,
  planCodeForCount,
  type Discount,
  type PricingPlayer,
} from './pricing'

// Placeholder settings from docs/05-business-rules.md — passed explicitly, never read from the seed.
const TSHIRT = 5000
const TRANSPORT = 10000
const PLAN = { solo: 20000, duo: 35000, trio: 50000, quad: 60000 }

const returning: PricingPlayer = { tshirtFils: 0, transportFils: 0 }
const firstTime: PricingPlayer = { tshirtFils: TSHIRT, transportFils: 0 }
const withTransport = (player: PricingPlayer): PricingPlayer => ({
  ...player,
  transportFils: TRANSPORT,
})

describe('calcSubscriptionTotal — worked examples (docs/05-business-rules.md)', () => {
  it.each<{
    n: number
    name: string
    plan: number
    players: PricingPlayer[]
    discount?: Discount
    subtotal: number
    discountOut: number
    total: number
  }>([
    {
      n: 1,
      name: 'Solo, returning, no transport, no discount',
      plan: PLAN.solo,
      players: [returning],
      subtotal: 20000,
      discountOut: 0,
      total: 20000,
    },
    {
      n: 2,
      name: 'Solo, first-time (T-shirt), no transport',
      plan: PLAN.solo,
      players: [firstTime],
      subtotal: 25000,
      discountOut: 0,
      total: 25000,
    },
    {
      n: 3,
      name: 'Duo: A first-time + transport, B returning; 10% code',
      plan: PLAN.duo,
      players: [withTransport(firstTime), returning],
      discount: { type: 'percent', bps: 1000 },
      subtotal: 50000,
      discountOut: 5000,
      total: 45000,
    },
    {
      n: 4,
      name: 'Solo + T-shirt, fixed 3000',
      plan: PLAN.solo,
      players: [firstTime],
      discount: { type: 'fixed', fils: 3000 },
      subtotal: 25000,
      discountOut: 3000,
      total: 22000,
    },
    {
      n: 5,
      name: 'Solo, fixed discount larger than the subtotal (capped)',
      plan: PLAN.solo,
      players: [returning],
      discount: { type: 'fixed', fils: 30000 },
      subtotal: 20000,
      discountOut: 20000,
      total: 0,
    },
    {
      n: 6,
      name: 'Quad, all returning, 2 with transport, 15% manual',
      plan: PLAN.quad,
      players: [withTransport(returning), withTransport(returning), returning, returning],
      discount: { type: 'percent', bps: 1500 },
      subtotal: 80000,
      discountOut: 12000,
      total: 68000,
    },
    {
      n: 7,
      name: 'Rounding: Solo + transport + T-shirt, 12.5%',
      plan: PLAN.solo,
      players: [withTransport(firstTime)],
      discount: { type: 'percent', bps: 1250 },
      subtotal: 35000,
      discountOut: 4375,
      total: 30625,
    },
  ])('#$n $name', ({ plan, players, discount, subtotal, discountOut, total }) => {
    const result = calcSubscriptionTotal({ planPriceFils: plan, players, discount })
    expect(result.subtotalFils).toBe(subtotal)
    expect(result.discountFils).toBe(discountOut)
    expect(result.totalFils).toBe(total)
    // The stored total must always equal its parts (the table's check constraint).
    expect(result.totalFils).toBe(
      result.planPriceFils +
        result.tshirtTotalFils +
        result.transportTotalFils -
        result.discountFils,
    )
  })

  it('reports the fee totals separately, for the line-item breakdown and the stored columns', () => {
    const result = calcSubscriptionTotal({
      planPriceFils: PLAN.duo,
      players: [withTransport(firstTime), withTransport(firstTime)],
    })
    expect(result).toEqual({
      planPriceFils: 35000,
      tshirtTotalFils: 10000,
      transportTotalFils: 20000,
      subtotalFils: 65000,
      discountFils: 0,
      totalFils: 65000,
    })
  })
})

describe('discountFils', () => {
  it('rounds percent discounts half up to the nearest fil', () => {
    // 1 fil × 50% = 0.5 → 1;  3 fils × 50% = 1.5 → 2;  20001 × 12.5% = 2500.125 → 2500
    expect(discountFils(1, { type: 'percent', bps: 5000 })).toBe(1)
    expect(discountFils(3, { type: 'percent', bps: 5000 })).toBe(2)
    expect(discountFils(20001, { type: 'percent', bps: 1250 })).toBe(2500)
    expect(discountFils(20003, { type: 'percent', bps: 1250 })).toBe(2500) // 2500.375
    expect(discountFils(20004, { type: 'percent', bps: 1250 })).toBe(2501) // 2500.5
  })

  it('never exceeds the subtotal, so the total can never go negative', () => {
    expect(discountFils(20000, { type: 'fixed', fils: 999999 })).toBe(20000)
    expect(discountFils(20000, { type: 'percent', bps: 10000 })).toBe(20000)
  })

  it('is zero without a discount or with a zero-value one', () => {
    expect(discountFils(20000, null)).toBe(0)
    expect(discountFils(20000, undefined)).toBe(0)
    expect(discountFils(20000, { type: 'fixed', fils: 0 })).toBe(0)
    expect(discountFils(0, { type: 'percent', bps: 1000 })).toBe(0)
  })

  it('rejects impossible percentages', () => {
    expect(() => discountFils(1000, { type: 'percent', bps: 10001 })).toThrow(RangeError)
    expect(() => discountFils(1000, { type: 'percent', bps: -1 })).toThrow(RangeError)
    expect(() => discountFils(1000, { type: 'percent', bps: 12.5 })).toThrow(RangeError)
  })
})

describe('integer-fils guard', () => {
  it('refuses floats and negatives instead of silently producing wrong money', () => {
    expect(() => calcSubscriptionTotal({ planPriceFils: 20.5, players: [returning] })).toThrow(
      RangeError,
    )
    expect(() => calcSubscriptionTotal({ planPriceFils: -1, players: [returning] })).toThrow(
      RangeError,
    )
    expect(() =>
      calcSubscriptionTotal({
        planPriceFils: 20000,
        players: [{ tshirtFils: 0.1, transportFils: 0 }],
      }),
    ).toThrow(RangeError)
    expect(() =>
      calcSubscriptionTotal({
        planPriceFils: 20000,
        players: [returning],
        discount: { type: 'fixed', fils: 1.5 },
      }),
    ).toThrow(RangeError)
  })
})

describe('planCodeForCount', () => {
  it('maps 1–4 players to Solo/Duo/Trio/Quad and nothing else', () => {
    expect([1, 2, 3, 4].map(planCodeForCount)).toEqual(['solo', 'duo', 'trio', 'quad'])
    expect(planCodeForCount(0)).toBeNull()
    expect(planCodeForCount(5)).toBeNull()
  })
})
