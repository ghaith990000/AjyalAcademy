import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Plan = Tables<'plans'>
export type Settings = Tables<'settings'>

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('*').order('player_count')
  if (error) throw error
  return data
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) throw error
  return data
}

export interface SettingsInput {
  planPrices: { id: string; price_fils: number }[]
  tshirt_fee_fils: number
  transport_fee_fils: number
  expiring_soon_days: number
}

/** Plan prices and fees are separate rows/tables; run them together and fail loudly if any write fails. */
export async function saveSettings(input: SettingsInput): Promise<void> {
  const results = await Promise.all([
    ...input.planPrices.map(({ id, price_fils }) =>
      supabase.from('plans').update({ price_fils }).eq('id', id),
    ),
    supabase
      .from('settings')
      .update({
        tshirt_fee_fils: input.tshirt_fee_fils,
        transport_fee_fils: input.transport_fee_fils,
        expiring_soon_days: input.expiring_soon_days,
      })
      .eq('id', true),
  ])
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}
