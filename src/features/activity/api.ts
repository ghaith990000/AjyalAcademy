import { supabase } from '@/lib/supabase'
import { FILTER_ENTITY_TYPES, type ActivityFilter, type ActivityRow } from './activity'

export const ACTIVITY_PAGE_SIZE = 15

/** Where the next page starts: just after this entry, newest first. */
export interface ActivityCursor {
  createdAt: string
  id: string
}

/**
 * The feed, newest first. A page is found by "older than this entry" rather than by row offset, so entries that
 * arrive live at the top never shift what "the next page" means. Entries written in one transaction share a
 * timestamp, hence the id as the tie-break. Row-level security decides whose entries these are: an admin sees
 * everyone's, a coach only their own.
 */
export async function listActivity(
  filter: ActivityFilter,
  cursor: ActivityCursor | null,
): Promise<{ rows: ActivityRow[]; next: ActivityCursor | null }> {
  let query = supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE + 1) // one extra tells whether there is another page
  if (filter !== 'all') query = query.in('entity_type', [...FILTER_ENTITY_TYPES[filter]])
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }
  const { data, error } = await query
  if (error) throw error
  const rows = data.slice(0, ACTIVITY_PAGE_SIZE)
  const last = rows.at(-1)
  return {
    rows,
    next:
      data.length > ACTIVITY_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null,
  }
}
