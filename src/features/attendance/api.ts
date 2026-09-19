import { supabase } from '@/lib/supabase'
import type { Mark, SavedMark } from './marks'

export interface RosterPlayer {
  id: string
  full_name: string
}

/** A saved mark with the player's name (null when the player belongs to another coach now — RLS hides them). */
export interface SessionAttendanceRow extends SavedMark {
  marked_at: string
  player: RosterPlayer | null
}

/** A row of the `player_attendance` view (the generated view type is all-nullable). */
export interface PlayerAttendanceRow {
  session_id: string
  status: Mark
  marked_at: string
  session_date: string
  start_time: string
  end_time: string
  location: string | null
}

export const PLAYER_ATTENDANCE_PAGE_SIZE = 10

/** The session coach's active players — the roster of a session (docs/05-business-rules.md). */
export async function listRoster(coachId: string): Promise<RosterPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('full_name')
  if (error) throw error
  return data
}

export async function getSessionAttendance(sessionId: string): Promise<SessionAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('player_id, status, marked_at, player:players(id, full_name)')
    .eq('session_id', sessionId)
  if (error) throw error
  return data as unknown as SessionAttendanceRow[]
}

export async function saveAttendance(sessionId: string, records: SavedMark[]): Promise<void> {
  const { error } = await supabase.rpc('save_attendance', {
    p_session_id: sessionId,
    p_records: records,
  })
  if (error) throw error
}

/** A player's attendance, most recent session first (cancelled sessions are not in the view). */
export async function listPlayerAttendance(
  playerId: string,
  page: number,
): Promise<{ rows: PlayerAttendanceRow[]; total: number }> {
  const from = page * PLAYER_ATTENDANCE_PAGE_SIZE
  const { data, error, count } = await supabase
    .from('player_attendance')
    .select('*', { count: 'exact' })
    .eq('player_id', playerId)
    .order('session_date', { ascending: false })
    .order('start_time', { ascending: false })
    .order('session_id')
    .range(from, from + PLAYER_ATTENDANCE_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as unknown as PlayerAttendanceRow[], total: count ?? 0 }
}

/** In how many of the player's (counted) sessions they were present — the numerator of the rate. */
export async function countPlayerPresent(playerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('player_attendance')
    .select('session_id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('status', 'present')
  if (error) throw error
  return count ?? 0
}
