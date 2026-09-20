import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export interface PublicLocation {
  id: string
  name: string
  address: string | null
}

/** The active locations, for the form's picker. Anyone may call it (the form has no login). */
export async function listPublicLocations(): Promise<PublicLocation[]> {
  const { data, error } = await supabase.rpc('public_locations')
  if (error) throw error
  return data
}

export interface ChildInput {
  full_name: string
  cpr: string
  date_of_birth: string
  address: string | null
  school: string | null
  has_disease: boolean
  disease_description: string | null
}

export interface SubmitInput {
  /** Made once per form: a retry after a dropped connection is recognised and stored only once. */
  submissionId: string
  guardianName: string
  phone: string
  /** `null` = the parent chose none (or there were none to choose from). */
  locationId: string | null
  language: 'ar' | 'en'
  children: ChildInput[]
  /** The hidden field a person never fills. */
  website: string
}

/** The generated types cannot express NULL for an argument that has no default; the function accepts it. */
const orNullArg = (value: string | null) => value as string

/** Sends the request. The database learns nothing about who is asking, and tells nothing back. */
export async function submitApplications(input: SubmitInput): Promise<void> {
  const { error } = await supabase.rpc('submit_player_applications', {
    p_submission_id: input.submissionId,
    p_guardian_name: input.guardianName,
    p_phone: input.phone.replace(/\s+/g, ''),
    p_location_id: orNullArg(input.locationId),
    p_language: input.language,
    p_children: input.children as unknown as Json,
    p_website: input.website,
  })
  if (error) throw error
}
