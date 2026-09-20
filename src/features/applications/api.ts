import type { Database } from '@/lib/database.types'
import { ajyalCodeOf, errorDetailOf } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type ApplicationStatus = Database['public']['Enums']['application_status']
export const APPLICATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
] as const satisfies readonly ApplicationStatus[]

/** One child's registration request, as the admin list and detail page read it (`player_application_overview`). */
export interface ApplicationRow {
  id: string
  /** The requests sent together by one parent share this. */
  submission_id: string
  guardian_name: string
  phone: string
  /** The language the parent used: the WhatsApp message is written in it. */
  language: 'ar' | 'en'
  location_id: string | null
  location_name: string | null
  full_name: string
  cpr: string
  date_of_birth: string
  address: string | null
  school: string | null
  has_disease: boolean
  disease_description: string | null
  status: ApplicationStatus
  created_at: string
  decided_at: string | null
  decided_by_name: string | null
  decision_note: string | null
  /** Set once accepted. */
  player_id: string | null
  /** While pending: a player who already has this CPR, and how many other pending requests share it. */
  existing_player_id: string | null
  existing_player_name: string | null
  same_cpr_pending: number
}

export const APPLICATIONS_PAGE_SIZE = 20

export async function listApplications(
  status: ApplicationStatus,
  page: number,
): Promise<{ rows: ApplicationRow[]; total: number }> {
  const from = page * APPLICATIONS_PAGE_SIZE
  const { data, error, count } = await supabase
    .from('player_application_overview')
    .select('*', { count: 'exact' })
    .eq('status', status)
    // A queue is served oldest first; what is decided is looked up newest first.
    .order('created_at', { ascending: status === 'pending' })
    .order('id')
    .range(from, from + APPLICATIONS_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as unknown as ApplicationRow[], total: count ?? 0 }
}

/** `null` when there is no such request (or the caller may not see it: only admins can). */
export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const { data, error } = await supabase
    .from('player_application_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as ApplicationRow | null
}

export async function countPendingApplications(): Promise<number> {
  const { count, error } = await supabase
    .from('player_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

/** The CPR already belongs to a player. `playerId` is that player (the database names it), when known. */
export class CprTakenError extends Error {
  constructor(readonly playerId: string | null) {
    super('CPR taken')
  }
}

export interface AcceptInput {
  id: string
  /** `null` = no coach yet. */
  coachId: string | null
  /** `null` = no location. */
  locationId: string | null
}

/** The generated types cannot express NULL for an argument that has no default; the function accepts it. */
const orNullArg = (value: string | null) => value as string

/** Creates the player and marks the request accepted. Returns the new player's id. */
export async function acceptApplication(input: AcceptInput): Promise<string> {
  const { data, error } = await supabase.rpc('accept_player_application', {
    p_application_id: input.id,
    p_coach_id: orNullArg(input.coachId),
    p_location_id: orNullArg(input.locationId),
  })
  if (error) {
    if (ajyalCodeOf(error) === 'cpr_taken') throw new CprTakenError(errorDetailOf(error))
    throw error
  }
  return data
}

export async function rejectApplication(input: { id: string; note: string }): Promise<void> {
  const note = input.note.trim()
  const { error } = await supabase.rpc('reject_player_application', {
    p_application_id: input.id,
    ...(note === '' ? {} : { p_note: note }),
  })
  if (error) throw error
}
