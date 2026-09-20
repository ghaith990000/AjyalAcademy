import type { LocationRow } from '@/features/locations/api'
import type { PlayerRow } from '@/features/players/api'
import type { Plan, Settings } from '@/features/settings/api'
import { defaultEndDate, isValidISODate } from '@/lib/dates'
import { parsePercentToBps } from '@/lib/discounts'
import { parseBD } from '@/lib/money'
import {
  calcSubscriptionTotal,
  planCodeForCount,
  type Discount as PricingDiscount,
  type PricingResult,
} from '@/lib/pricing'
import type { CreateSubscriptionParams, Discount, PaymentMethod } from './api'

/**
 * The state and rules of the "new subscription" wizard, kept free of React so they can be tested against the
 * worked examples. The live total here is only a PREVIEW: `create_subscription` recomputes everything.
 */

export const STEPS = ['players', 'dates', 'options', 'discount', 'summary', 'payment'] as const
export type Step = (typeof STEPS)[number]

export const MAX_PLAYERS = 4

export type DiscountMode = 'none' | 'code' | 'manual'
export type PayMode = 'full' | 'partial' | 'unpaid'

export interface Draft {
  players: PlayerRow[]
  start: string
  end: string
  /** Once the user edits the end date, changing the start no longer moves it. */
  endTouched: boolean
  /** The location picked by hand; '' = not chosen yet (then the players' shared location is offered). */
  locationId: string
  transport: Record<string, boolean>
  /** Admin-only T-shirt overrides; a missing key means "automatic" (first subscription ⇒ charged). */
  tshirt: Record<string, boolean>
  discountMode: DiscountMode
  code: string
  manualType: 'percent' | 'fixed'
  manualValue: string
  manualReason: string
  payMode: PayMode
  payAmount: string
  method: PaymentMethod
}

export function initialDraft(today: string): Draft {
  return {
    players: [],
    start: today,
    end: defaultEndDate(today),
    endTouched: false,
    locationId: '',
    transport: {},
    tshirt: {},
    discountMode: 'none',
    code: '',
    manualType: 'percent',
    manualValue: '',
    manualReason: '',
    payMode: 'full',
    payAmount: '',
    method: 'cash',
  }
}

export interface DraftContext {
  plans: readonly Plan[]
  settings: Settings | undefined
  /** Selected players that already have a subscription (so no first-time T-shirt fee). */
  returning: ReadonlySet<string>
  isAdmin: boolean
  /** Discounts the user may apply (active ones). */
  discounts: readonly Discount[]
  /** "yyyy-MM-dd" — the code's validity is checked against it. */
  today: string
  /** Every location (switched-off ones too); only active ones can be chosen. */
  locations: readonly LocationRow[]
}

// ---- edits -----------------------------------------------------------------------------------------------

export function withStart(draft: Draft, start: string): Draft {
  const end = !draft.endTouched && isValidISODate(start) ? defaultEndDate(start) : draft.end
  return { ...draft, start, end }
}

export function withEnd(draft: Draft, end: string): Draft {
  return { ...draft, end, endTouched: true }
}

export function withLocation(draft: Draft, locationId: string): Draft {
  return { ...draft, locationId }
}

/**
 * The location the wizard offers before the user picks one: the one every selected player shares, if it is
 * still in use. Players in different locations (or none) offer nothing — the user chooses.
 */
export function sharedPlayerLocation(draft: Draft, ctx: DraftContext): string {
  const ids = new Set(draft.players.map((player) => player.location_id))
  const [only] = ids
  if (ids.size !== 1 || !only) return ''
  return ctx.locations.some((location) => location.id === only && location.active) ? only : ''
}

/** The location that will be sent: the user's choice, else the players' shared one. */
export function effectiveLocationId(draft: Draft, ctx: DraftContext): string {
  return draft.locationId !== '' ? draft.locationId : sharedPlayerLocation(draft, ctx)
}

/** Add or remove a player (max four); options of removed players are dropped. */
export function withPlayerToggled(draft: Draft, player: PlayerRow): Draft {
  const selected = draft.players.some((p) => p.id === player.id)
  if (!selected && draft.players.length >= MAX_PLAYERS) return draft
  const players = selected
    ? draft.players.filter((p) => p.id !== player.id)
    : [...draft.players, player]
  const keep = new Set(players.map((p) => p.id))
  const only = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => keep.has(id)))
  return { ...draft, players, transport: only(draft.transport), tshirt: only(draft.tshirt) }
}

// ---- pricing ---------------------------------------------------------------------------------------------

/** The plan that fits the number of selected players (must exist and be active). */
export function planFor(draft: Draft, ctx: DraftContext): Plan | undefined {
  const code = planCodeForCount(draft.players.length)
  return code ? ctx.plans.find((plan) => plan.code === code && plan.active) : undefined
}

/** Whether the T-shirt fee applies: an admin's explicit choice wins; otherwise first subscription ⇒ yes. */
export function tshirtApplies(draft: Draft, playerId: string, ctx: DraftContext): boolean {
  const override = draft.tshirt[playerId]
  if (ctx.isAdmin && override !== undefined) return override
  return !ctx.returning.has(playerId)
}

export type DiscountError =
  | 'code_required'
  | 'code_not_found'
  | 'code_expired'
  | 'code_not_started'
  | 'reason_required'
  | 'value_invalid'

export type DiscountCheck =
  | { kind: 'none' }
  | { kind: 'ok'; pricing: PricingDiscount; code: Discount | null; reason: string | null }
  | { kind: 'error'; error: DiscountError }

export function checkDiscount(draft: Draft, ctx: DraftContext): DiscountCheck {
  if (draft.discountMode === 'none') return { kind: 'none' }

  if (draft.discountMode === 'code') {
    const typed = draft.code.trim().toLowerCase()
    if (typed === '') return { kind: 'error', error: 'code_required' }
    const found = ctx.discounts.find((d) => d.code.toLowerCase() === typed)
    if (!found) return { kind: 'error', error: 'code_not_found' }
    if (found.valid_from && found.valid_from > ctx.today) {
      return { kind: 'error', error: 'code_not_started' }
    }
    if (found.valid_to && found.valid_to < ctx.today) {
      return { kind: 'error', error: 'code_expired' }
    }
    const pricing: PricingDiscount =
      found.type === 'percent'
        ? { type: 'percent', bps: found.value }
        : { type: 'fixed', fils: found.value }
    return { kind: 'ok', pricing, code: found, reason: null }
  }

  const reason = draft.manualReason.trim()
  if (reason === '') return { kind: 'error', error: 'reason_required' }
  if (draft.manualType === 'percent') {
    const bps = parsePercentToBps(draft.manualValue)
    if (bps === null) return { kind: 'error', error: 'value_invalid' }
    return { kind: 'ok', pricing: { type: 'percent', bps }, code: null, reason }
  }
  const fils = parseBD(draft.manualValue)
  if (fils === null || fils <= 0) return { kind: 'error', error: 'value_invalid' }
  return { kind: 'ok', pricing: { type: 'fixed', fils }, code: null, reason }
}

/** Live price preview; null while the plan or settings are missing. A bad discount is ignored here (the step blocks it). */
export function computePricing(draft: Draft, ctx: DraftContext): PricingResult | null {
  const plan = planFor(draft, ctx)
  if (!plan || !ctx.settings) return null
  const discount = checkDiscount(draft, ctx)
  return calcSubscriptionTotal({
    planPriceFils: plan.price_fils,
    players: draft.players.map((player) => ({
      tshirtFils: tshirtApplies(draft, player.id, ctx) ? ctx.settings!.tshirt_fee_fils : 0,
      transportFils: draft.transport[player.id] ? ctx.settings!.transport_fee_fils : 0,
    })),
    discount: discount.kind === 'ok' ? discount.pricing : null,
  })
}

// ---- payment ---------------------------------------------------------------------------------------------

/** Fils to record now: the total (full), the typed amount (partial), or 0 (unpaid). null = invalid partial amount. */
export function paymentAmount(draft: Draft, totalFils: number): number | null {
  if (draft.payMode === 'unpaid' || totalFils === 0) return 0
  if (draft.payMode === 'full') return totalFils
  const amount = parseBD(draft.payAmount)
  return amount !== null && amount >= 1 && amount <= totalFils ? amount : null
}

// ---- validation --------------------------------------------------------------------------------------------

export type StepError =
  | 'no_players'
  | 'plan_unavailable'
  | 'start_invalid'
  | 'end_invalid'
  | 'end_before_start'
  | 'location_required'
  | DiscountError
  | 'amount_invalid'

/** Why the user cannot leave this step yet, or null. Messages live in the `subscriptions` namespace. */
export function validateStep(step: Step, draft: Draft, ctx: DraftContext): StepError | null {
  switch (step) {
    case 'players':
      if (draft.players.length === 0) return 'no_players'
      return planFor(draft, ctx) ? null : 'plan_unavailable'
    case 'dates':
      if (!isValidISODate(draft.start)) return 'start_invalid'
      if (!isValidISODate(draft.end)) return 'end_invalid'
      if (draft.end < draft.start) return 'end_before_start'
      return effectiveLocationId(draft, ctx) === '' ? 'location_required' : null
    case 'discount': {
      const check = checkDiscount(draft, ctx)
      return check.kind === 'error' ? check.error : null
    }
    case 'payment': {
      const pricing = computePricing(draft, ctx)
      return pricing && paymentAmount(draft, pricing.totalFils) === null ? 'amount_invalid' : null
    }
    default:
      return null
  }
}

// ---- submit --------------------------------------------------------------------------------------------------

/** Arguments for `create_subscription`. Only an admin's explicit T-shirt choices are sent (the server ignores others). */
export function buildParams(draft: Draft, ctx: DraftContext): CreateSubscriptionParams {
  const pricing = computePricing(draft, ctx)
  const discount = checkDiscount(draft, ctx)
  const amount = pricing ? (paymentAmount(draft, pricing.totalFils) ?? 0) : 0

  const params: CreateSubscriptionParams = {
    p_start_date: draft.start,
    p_end_date: draft.end,
    p_location_id: effectiveLocationId(draft, ctx),
    p_players: draft.players.map((player) => ({
      player_id: player.id,
      transport: draft.transport[player.id] === true,
      ...(ctx.isAdmin && draft.tshirt[player.id] !== undefined
        ? { tshirt: draft.tshirt[player.id] }
        : {}),
    })),
  }
  if (discount.kind === 'ok') {
    if (discount.code) {
      params.p_discount_code = discount.code.code
    } else {
      params.p_manual_discount_type = draft.manualType
      params.p_manual_discount_value =
        discount.pricing.type === 'percent' ? discount.pricing.bps : discount.pricing.fils
      params.p_manual_discount_reason = discount.reason ?? undefined
    }
  }
  if (amount > 0) {
    params.p_initial_payment_fils = amount
    params.p_payment_method = draft.method
  }
  return params
}
