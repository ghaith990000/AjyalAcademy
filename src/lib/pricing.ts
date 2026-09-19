/**
 * Subscription pricing — the live preview in the form. The authoritative calculation is the SQL
 * function `calc_subscription_total` (used by `create_subscription`); both must agree with the worked
 * examples in docs/05-business-rules.md. Everything here is integer FILS; no floats.
 */

export type Discount = { type: 'percent'; bps: number } | { type: 'fixed'; fils: number }

export interface PricingPlayer {
  tshirtFils: number
  transportFils: number
}

export interface PricingInput {
  planPriceFils: number
  players: readonly PricingPlayer[]
  discount?: Discount | null
}

export interface PricingResult {
  planPriceFils: number
  tshirtTotalFils: number
  transportTotalFils: number
  subtotalFils: number
  discountFils: number
  totalFils: number
}

export const PLAN_CODES = ['solo', 'duo', 'trio', 'quad'] as const
export type PlanCode = (typeof PLAN_CODES)[number]

/** The plan is derived from how many players share the subscription (1–4). */
export function planCodeForCount(count: number): PlanCode | null {
  return PLAN_CODES[count - 1] ?? null
}

function assertFils(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative integer number of fils, got ${value}`)
  }
}

/** Discount amount for a subtotal: percent rounds half up to the nearest fil; never above the subtotal. */
export function discountFils(subtotalFils: number, discount: Discount | null | undefined): number {
  if (!discount) return 0
  let amount: number
  if (discount.type === 'percent') {
    if (!Number.isInteger(discount.bps) || discount.bps < 0 || discount.bps > 10_000) {
      throw new RangeError(`percent discount must be 0–10000 basis points, got ${discount.bps}`)
    }
    // Integer arithmetic (subtotal × bps ≤ ~10⁹): floor((x + 5000) / 10000) is round-half-up.
    amount = Math.floor((subtotalFils * discount.bps + 5000) / 10_000)
  } else {
    assertFils(discount.fils, 'fixed discount')
    amount = discount.fils
  }
  return Math.min(amount, subtotalFils)
}

export function calcSubscriptionTotal(input: PricingInput): PricingResult {
  assertFils(input.planPriceFils, 'plan price')
  let tshirtTotalFils = 0
  let transportTotalFils = 0
  for (const player of input.players) {
    assertFils(player.tshirtFils, 'T-shirt fee')
    assertFils(player.transportFils, 'transport fee')
    tshirtTotalFils += player.tshirtFils
    transportTotalFils += player.transportFils
  }
  const subtotalFils = input.planPriceFils + tshirtTotalFils + transportTotalFils
  const discount = discountFils(subtotalFils, input.discount)
  return {
    planPriceFils: input.planPriceFils,
    tshirtTotalFils,
    transportTotalFils,
    subtotalFils,
    discountFils: discount,
    totalFils: subtotalFils - discount,
  }
}
