import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { PlayerInput } from './schema'

export type PlayerRow = Tables<'players'> & {
  coach: { full_name: string } | null
  location: { name: string } | null
}

export interface PlayerFilters {
  search: string
  /** 'all' | 'unassigned' | a coach's profile id (admin only; RLS already scopes coaches). */
  coach: string
  hasCondition: boolean
  /** '' = every location, 'none' = players without one, or a location id. */
  location: string
  sort: 'name' | 'newest'
}

export const DEFAULT_FILTERS: PlayerFilters = {
  search: '',
  coach: 'all',
  hasCondition: false,
  location: '',
  sort: 'name',
}

export const PAGE_SIZE = 20

// Three foreign keys point at profiles (coach, creator, remover), so the embed names the one we want.
const SELECT = '*, coach:profiles!players_coach_id_fkey(full_name), location:locations(name)'

/** Remove characters that have meaning inside a PostgREST `or(...)` filter or an ILIKE pattern. */
export function cleanSearch(search: string): string {
  return search
    .replace(/[,()"\\%_*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function listPlayers(
  filters: PlayerFilters,
  page: number,
): Promise<{ rows: PlayerRow[]; total: number }> {
  let query = supabase
    .from('players')
    .select(SELECT, { count: 'exact' })
    // Admins can read removed players too; lists never show them.
    .is('deleted_at', null)

  const search = cleanSearch(filters.search)
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,cpr.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  if (filters.coach === 'unassigned') query = query.is('coach_id', null)
  else if (filters.coach !== 'all') query = query.eq('coach_id', filters.coach)
  if (filters.hasCondition) query = query.eq('has_disease', true)
  if (filters.location === 'none') query = query.is('location_id', null)
  else if (filters.location) query = query.eq('location_id', filters.location)

  query =
    filters.sort === 'newest'
      ? query.order('created_at', { ascending: false })
      : query.order('full_name', { ascending: true })
  // Tie-breaker so pages never overlap or skip rows when names/dates repeat.
  query = query.order('id')

  const from = page * PAGE_SIZE
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as PlayerRow[], total: count ?? 0 }
}

/** A removed or foreign (RLS-hidden) player looks the same as a missing one: `null`. */
export async function getPlayer(id: string): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from('players')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data as PlayerRow | null
}

/** The CPR is already registered. `existing` is set only if the caller is allowed to see that player. */
export class DuplicateCprError extends Error {
  constructor(readonly existing: { id: string; full_name: string } | null) {
    super('duplicate CPR')
  }
}

const UNIQUE_VIOLATION = '23505'

async function throwDuplicate(cpr: string): Promise<never> {
  // RLS decides whether the caller may see the existing player (coaches only see their own).
  const { data } = await supabase
    .from('players')
    .select('id, full_name')
    .eq('cpr', cpr)
    .is('deleted_at', null)
    .maybeSingle()
  throw new DuplicateCprError(data)
}

export async function createPlayer(input: PlayerInput): Promise<{ id: string }> {
  const { data, error } = await supabase.from('players').insert(input).select('id').single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) await throwDuplicate(input.cpr)
    throw error
  }
  return data
}

export class PlayerNotFoundError extends Error {
  constructor() {
    super('player not found')
  }
}

export async function updatePlayer(id: string, input: PlayerInput): Promise<void> {
  const { data, error } = await supabase.from('players').update(input).eq('id', id).select('id')
  if (error) {
    if (error.code === UNIQUE_VIOLATION) await throwDuplicate(input.cpr)
    throw error
  }
  // RLS turns "not yours" into zero affected rows rather than an error.
  if (data.length === 0) throw new PlayerNotFoundError()
}

export async function removePlayer(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_player', { p_player_id: id })
  if (error) throw error
}

/** Admin only. `coachId = null` unassigns. Returns how many players actually changed. */
export async function assignPlayers(playerIds: string[], coachId: string | null): Promise<number> {
  const { data, error } = await supabase.rpc(
    'assign_players',
    coachId === null
      ? { p_player_ids: playerIds }
      : { p_player_ids: playerIds, p_coach_id: coachId },
  )
  if (error) throw error
  return data
}
