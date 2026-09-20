import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type LocationRow = Tables<'locations'>

export interface LocationInput {
  name: string
  address: string | null
  active: boolean
}

export class DuplicateLocationError extends Error {
  constructor() {
    super('duplicate location name')
  }
}

const UNIQUE_VIOLATION = '23505'

/** Every location, switched-off ones included (past sessions, subscriptions and expenses still point at them). */
export async function listLocations(): Promise<LocationRow[]> {
  const { data, error } = await supabase.from('locations').select('*').order('name')
  if (error) throw error
  return data
}

export async function createLocation(input: LocationInput): Promise<void> {
  const { error } = await supabase.from('locations').insert(input)
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateLocationError()
    throw error
  }
}

/** Row-level security lets only admins update, so "no row changed" means "not allowed / not there". */
export async function updateLocation(id: string, input: LocationInput): Promise<void> {
  const { data, error } = await supabase.from('locations').update(input).eq('id', id).select('id')
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateLocationError()
    throw error
  }
  if (data.length === 0) throw new Error('ajyal:location_not_found')
}
