import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/dates'
import { doneFilter, type SessionStatus } from './schedule'
import type { SessionInput } from './schema'

/** A `training_sessions` row with the session coach's name embedded. */
export interface SessionRow {
  id: string
  session_date: string
  start_time: string
  end_time: string
  coach_id: string
  location_id: string | null
  notes: string | null
  cancelled_at: string | null
  created_by: string | null
  created_at: string
  coach: { full_name: string } | null
  location: { name: string } | null
}

export interface SessionFilters {
  status: 'all' | SessionStatus
  /** Admin only: '' = every coach. (A coach's RLS already limits them to their own.) */
  coachId: string
  /** '' = every location. */
  locationId: string
}

export const DEFAULT_SESSION_FILTERS: SessionFilters = { status: 'upcoming', coachId: '', locationId: '' }
export const SESSIONS_PAGE_SIZE = 20

// `created_by` is a second foreign key to `profiles`, so the embed needs the constraint name.
const SESSION_COLUMNS =
  '*, coach:profiles!training_sessions_coach_id_fkey(full_name), location:locations(name)'

/**
 * Sessions, soonest first for "upcoming" and most recent first otherwise. "Upcoming" means from today on,
 * whatever the time, so a coach can still take attendance for a session that has just ended; "done" means over
 * by the clock (see `doneFilter`) when the request is made.
 */
export async function listSessions(
  filters: SessionFilters,
  page: number,
): Promise<{ rows: SessionRow[]; total: number }> {
  let query = supabase.from('training_sessions').select(SESSION_COLUMNS, { count: 'exact' })
  if (filters.coachId) query = query.eq('coach_id', filters.coachId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.status === 'cancelled') {
    query = query.not('cancelled_at', 'is', null)
  } else if (filters.status === 'upcoming') {
    query = query.is('cancelled_at', null).gte('session_date', todayISO())
  } else if (filters.status === 'done') {
    query = query.is('cancelled_at', null).or(doneFilter())
  }
  const soonestFirst = filters.status === 'upcoming'
  query = query
    .order('session_date', { ascending: soonestFirst })
    .order('start_time', { ascending: soonestFirst })
    .order('id')

  const from = page * SESSIONS_PAGE_SIZE
  const { data, error, count } = await query.range(from, from + SESSIONS_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as unknown as SessionRow[], total: count ?? 0 }
}

/** Today's sessions that have not been cancelled, earliest first (a coach's RLS limits them to their own). */
export async function listTodaySessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(SESSION_COLUMNS)
    .eq('session_date', todayISO())
    .is('cancelled_at', null)
    .order('start_time')
    .order('id')
  if (error) throw error
  return data as unknown as SessionRow[]
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as SessionRow | null
}

/** One coach's not-cancelled sessions in a date range — what a new or edited session could clash with. */
export async function listCoachSessionsBetween(
  coachId: string,
  from: string,
  to: string,
): Promise<Pick<SessionRow, 'id' | 'session_date' | 'start_time' | 'end_time'>[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('id, session_date, start_time, end_time')
    .eq('coach_id', coachId)
    .is('cancelled_at', null)
    .gte('session_date', from)
    .lte('session_date', to)
  if (error) throw error
  return data
}

/** One insert statement, so a weekly series is created all-or-nothing. */
export async function createSessions(inputs: SessionInput[]): Promise<string[]> {
  const { data, error } = await supabase.from('training_sessions').insert(inputs).select('id')
  if (error) throw error
  return data.map((row) => row.id)
}

/** Row-level security hides other coaches' sessions, so "no row updated" means "not yours / not there". */
async function updateOne(id: string, changes: Partial<SessionInput> & { cancelled_at?: string }) {
  const { data, error } = await supabase
    .from('training_sessions')
    .update(changes)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('ajyal:session_not_found')
}

export const updateSession = (id: string, input: SessionInput) => updateOne(id, input)

/** Cancelling is final; the database stamps the time itself. */
export const cancelSession = (id: string) =>
  updateOne(id, { cancelled_at: new Date().toISOString() })
