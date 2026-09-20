import { cleanSearch } from '@/features/players/api'
import type { Database, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { SubscriptionStatus } from '@/lib/subscription-status'

export type PaymentMethod = Database['public']['Enums']['payment_method']
export type Discount = Tables<'discounts'>

/** A row of the `subscription_overview` view (the generated view type is all-nullable). */
export interface SubscriptionRow {
  id: string
  plan_id: string
  plan_code: string
  start_date: string
  end_date: string
  plan_price_fils: number
  tshirt_total_fils: number
  transport_total_fils: number
  discount_id: string | null
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  discount_reason: string | null
  discount_fils: number
  total_fils: number
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  paid_fils: number
  balance_fils: number
  status: SubscriptionStatus
  /** Only the players the caller may see (a coach sees their own in a mixed subscription). */
  player_names: string | null
  player_count: number
  /** null for a subscription that pre-dates locations and has not been given one yet. */
  location_id: string | null
  location_name: string | null
}

export interface SubscriptionPlayerRow {
  player_id: string
  tshirt_fee_fils: number
  transport_fee_fils: number
  /** null when the player belongs to another coach (RLS hides them). */
  player: { id: string; full_name: string } | null
}

export interface PaymentRow {
  id: string
  amount_fils: number
  paid_at: string
  method: PaymentMethod
  note: string | null
  created_at: string
  /** null when the receiver's profile is not visible to the caller. */
  received: { full_name: string } | null
}

export interface SubscriptionFilters {
  status: 'all' | SubscriptionStatus
  search: string
  /** '' = every location, 'none' = subscriptions without one, or a location id. */
  locationId: string
}

export const DEFAULT_SUBSCRIPTION_FILTERS: SubscriptionFilters = { status: 'all', search: '', locationId: '' }
export const SUBSCRIPTIONS_PAGE_SIZE = 20

export async function listSubscriptions(
  filters: SubscriptionFilters,
  page: number,
): Promise<{ rows: SubscriptionRow[]; total: number }> {
  let query = supabase.from('subscription_overview').select('*', { count: 'exact' })
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.locationId === 'none') query = query.is('location_id', null)
  else if (filters.locationId) query = query.eq('location_id', filters.locationId)
  const search = cleanSearch(filters.search)
  if (search) query = query.ilike('player_names', `%${search}%`)
  query = query
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')

  const from = page * SUBSCRIPTIONS_PAGE_SIZE
  const { data, error, count } = await query.range(from, from + SUBSCRIPTIONS_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as unknown as SubscriptionRow[], total: count ?? 0 }
}

export async function getSubscription(id: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscription_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as SubscriptionRow | null
}

export async function getSubscriptionPlayers(id: string): Promise<SubscriptionPlayerRow[]> {
  const { data, error } = await supabase
    .from('subscription_players')
    .select('player_id, tshirt_fee_fils, transport_fee_fils, player:players(id, full_name)')
    .eq('subscription_id', id)
  if (error) throw error
  return data as unknown as SubscriptionPlayerRow[]
}

export async function getSubscriptionPayments(id: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount_fils, paid_at, method, note, created_at, received:profiles!payments_received_by_fkey(full_name)',
    )
    .eq('subscription_id', id)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as PaymentRow[]
}

/** The code and name of the discount used (a coach only sees active ones, so this may be null). */
export async function getDiscountLabel(id: string): Promise<{ name: string; code: string } | null> {
  const { data, error } = await supabase
    .from('discounts')
    .select('name, code')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Every subscription (newest first) that includes this player. */
export async function listPlayerSubscriptions(playerId: string): Promise<SubscriptionRow[]> {
  const { data: links, error: linkError } = await supabase
    .from('subscription_players')
    .select('subscription_id')
    .eq('player_id', playerId)
  if (linkError) throw linkError
  const ids = links.map((link) => link.subscription_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('subscription_overview')
    .select('*')
    .in('id', ids)
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as unknown as SubscriptionRow[]
}

/** player id → the status of the subscription that best describes them today (missing = none). */
export async function listPlayerStatuses(
  playerIds: string[],
): Promise<Record<string, SubscriptionStatus>> {
  if (playerIds.length === 0) return {}
  const { data, error } = await supabase
    .from('player_subscription_status')
    .select('player_id, status')
    .in('player_id', playerIds)
  if (error) throw error
  const statuses: Record<string, SubscriptionStatus> = {}
  for (const row of data) {
    if (row.player_id && row.status) statuses[row.player_id] = row.status as SubscriptionStatus
  }
  return statuses
}

/** Which of these players already have any subscription (cancelled ones count) — i.e. are NOT first-timers. */
export async function listReturningPlayers(playerIds: string[]): Promise<string[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('subscription_players')
    .select('player_id')
    .in('player_id', playerIds)
  if (error) throw error
  return [...new Set(data.map((row) => row.player_id))]
}

/** Discounts the caller may apply (RLS shows coaches only active ones). */
export async function listApplicableDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase.from('discounts').select('*').eq('active', true)
  if (error) throw error
  return data
}

export type CreateSubscriptionParams =
  Database['public']['Functions']['create_subscription']['Args']
export type RecordPaymentParams = Database['public']['Functions']['record_payment']['Args']

export async function createSubscription(params: CreateSubscriptionParams): Promise<string> {
  const { data, error } = await supabase.rpc('create_subscription', params)
  if (error) throw error
  return data
}

export async function recordPayment(params: RecordPaymentParams): Promise<string> {
  const { data, error } = await supabase.rpc('record_payment', params)
  if (error) throw error
  return data
}

/** Admin only: labels an older subscription or corrects a mistake (logged). Moves all its money to that location. */
export async function setSubscriptionLocation(id: string, locationId: string): Promise<void> {
  const { error } = await supabase.rpc('set_subscription_location', {
    p_subscription_id: id,
    p_location_id: locationId,
  })
  if (error) throw error
}

export async function cancelSubscription(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_subscription', {
    p_subscription_id: id,
    p_reason: reason,
  })
  if (error) throw error
}

/**
 * Which of these players are covered by a not-cancelled subscription on `date` (either end inclusive). Used by
 * the attendance roster's "no active subscription" warning, which asks about the session's own day rather
 * than today.
 */
export async function listPlayersCoveredOn(playerIds: string[], date: string): Promise<string[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('subscription_players')
    .select('player_id, subscriptions!inner(start_date, end_date, cancelled_at)')
    .in('player_id', playerIds)
    .is('subscriptions.cancelled_at', null)
    .lte('subscriptions.start_date', date)
    .gte('subscriptions.end_date', date)
  if (error) throw error
  return [...new Set(data.map((row) => row.player_id))]
}
