import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Discount = Tables<'discounts'>
/** A discount with how many non-cancelled subscriptions used it. */
export type DiscountWithUses = Discount & { uses: number }

export interface DiscountInput {
  name: string
  code: string
  type: 'percent' | 'fixed'
  /** bps for percent, fils for fixed */
  value: number
  valid_from: string | null
  valid_to: string | null
  max_uses: number | null
  active: boolean
}

export async function listDiscounts(): Promise<DiscountWithUses[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select('*, subscriptions(count)')
    // Only non-cancelled subscriptions count as a use (a cancelled one frees it).
    .is('subscriptions.cancelled_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(({ subscriptions, ...discount }) => ({
    ...discount,
    uses: subscriptions[0]?.count ?? 0,
  }))
}

export class DuplicateCodeError extends Error {
  constructor() {
    super('duplicate discount code')
  }
}

const UNIQUE_VIOLATION = '23505'

export async function createDiscount(input: DiscountInput): Promise<void> {
  const { error } = await supabase.from('discounts').insert(input)
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateCodeError()
    throw error
  }
}

export async function updateDiscount(id: string, input: DiscountInput): Promise<void> {
  const { error } = await supabase.from('discounts').update(input).eq('id', id)
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateCodeError()
    throw error
  }
}
