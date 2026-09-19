import type { SubscriptionRow } from '@/features/subscriptions/api'
import { supabase } from '@/lib/supabase'

/** Players who have not been removed (a coach's RLS limits this to their own). */
export async function countPlayers(): Promise<number> {
  const { count, error } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

/** Subscriptions running today — active, or active but ending soon (the same words the Subscriptions page uses). */
export async function countActiveSubscriptions(): Promise<number> {
  const { count, error } = await supabase
    .from('subscription_overview')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'expiring_soon'])
  if (error) throw error
  return count ?? 0
}

export const EXPIRING_LIST_SIZE = 5

/** The subscriptions ending soonest (status `expiring_soon`, judged by the database), and how many there are. */
export async function listExpiringSubscriptions(): Promise<{
  rows: SubscriptionRow[]
  total: number
}> {
  const { data, error, count } = await supabase
    .from('subscription_overview')
    .select('*', { count: 'exact' })
    .eq('status', 'expiring_soon')
    .order('end_date')
    .order('id')
    .limit(EXPIRING_LIST_SIZE)
  if (error) throw error
  return { rows: data as unknown as SubscriptionRow[], total: count ?? 0 }
}
