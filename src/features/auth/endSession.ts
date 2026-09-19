import { supabase } from '@/lib/supabase'
import { markSessionEnded } from './sessionNotice'

/**
 * The server no longer accepts this login (expired or revoked): leave it here, remember to say why, and let the
 * route guard send the person to the login screen. Local scope — there is no session left to revoke remotely.
 */
export function endSession(): void {
  markSessionEnded()
  void supabase.auth.signOut({ scope: 'local' })
}
