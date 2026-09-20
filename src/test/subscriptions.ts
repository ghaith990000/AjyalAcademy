import type { Plan, Settings } from '@/features/settings/api'
import type { SubscriptionRow } from '@/features/subscriptions/api'

let counter = 0

/** A `subscription_overview` row: solo, first-time player, unpaid, active. */
export function fakeSubscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  counter += 1
  return {
    id: `s${counter}`,
    plan_id: 'plan-solo',
    plan_code: 'solo',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    plan_price_fils: 20000,
    tshirt_total_fils: 5000,
    transport_total_fils: 0,
    discount_id: null,
    discount_type: null,
    discount_value: null,
    discount_reason: null,
    discount_fils: 0,
    total_fils: 25000,
    cancelled_at: null,
    cancel_reason: null,
    created_at: '2026-10-01T08:00:00Z',
    paid_fils: 0,
    balance_fils: 25000,
    status: 'active',
    player_names: 'Yousef Al Mahmood',
    player_count: 1,
    location_id: 'loc-1',
    location_name: 'Al-Rifa',
    ...overrides,
  }
}

/** The placeholder prices and fees from docs/05-business-rules.md — explicit, never read from a seed. */
export const PLANS: Plan[] = [
  { id: 'plan-solo', code: 'solo', player_count: 1, price_fils: 20000, active: true },
  { id: 'plan-duo', code: 'duo', player_count: 2, price_fils: 35000, active: true },
  { id: 'plan-trio', code: 'trio', player_count: 3, price_fils: 50000, active: true },
  { id: 'plan-quad', code: 'quad', player_count: 4, price_fils: 60000, active: true },
]

export const SETTINGS: Settings = {
  id: true,
  tshirt_fee_fils: 5000,
  transport_fee_fils: 10000,
  expiring_soon_days: 7,
}
