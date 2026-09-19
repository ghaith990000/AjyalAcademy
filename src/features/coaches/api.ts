import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Coach = Tables<'profiles'>

export interface NewCoach {
  full_name: string
  email: string
  password: string
  phone: string | null
  monthly_salary_fils: number
  preferred_language: 'ar' | 'en'
}

export interface CoachChanges {
  full_name: string
  phone: string | null
  monthly_salary_fils: number
  active: boolean
}

export async function listCoaches(): Promise<Coach[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'coach')
    .order('full_name')
  if (error) throw error
  return data
}

export async function updateCoach(id: string, changes: CoachChanges): Promise<void> {
  const { error } = await supabase.from('profiles').update(changes).eq('id', id)
  if (error) throw error
}

/** Error codes returned by the `create-coach` Edge Function that a form can react to. */
export type CreateCoachErrorCode = 'email_taken' | 'weak_password' | 'invalid_input' | 'unknown'

export class CreateCoachError extends Error {
  constructor(
    readonly code: CreateCoachErrorCode,
    readonly field?: string,
  ) {
    super(`create-coach failed: ${code}`)
  }
}

const KNOWN_CODES: readonly CreateCoachErrorCode[] = [
  'email_taken',
  'weak_password',
  'invalid_input',
]

/** Accounts are created by an Edge Function because it needs the service-role key (never in the browser). */
export async function createCoach(input: NewCoach): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke<{ id: string }>('create-coach', {
    body: input,
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => ({}))) as {
        error?: string
        field?: string
      }
      const code = KNOWN_CODES.find((known) => known === body.error) ?? 'unknown'
      throw new CreateCoachError(code, body.field)
    }
    throw error
  }
  if (!data) throw new CreateCoachError('unknown')
  return data
}
