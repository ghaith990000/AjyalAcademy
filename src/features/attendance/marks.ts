export type Mark = 'present' | 'absent'
/** player id → mark, for every player on the roster. */
export type Marks = Record<string, Mark>

// A type alias (not an interface) so it is assignable to the RPC's `Json` argument.
export type SavedMark = {
  player_id: string
  status: Mark
}

/**
 * The starting point of the attendance screen: what was saved for each rostered player, and "absent" for
 * everyone not marked yet (so only the players who came need a tap). Saved marks of players who have since
 * left the roster are not part of the screen.
 */
export function initialMarks(rosterIds: readonly string[], saved: readonly SavedMark[]): Marks {
  const byPlayer = new Map(saved.map((mark) => [mark.player_id, mark.status]))
  return Object.fromEntries(rosterIds.map((id) => [id, byPlayer.get(id) ?? 'absent']))
}

export const flip = (mark: Mark): Mark => (mark === 'present' ? 'absent' : 'present')

export function markAll(rosterIds: readonly string[], mark: Mark): Marks {
  return Object.fromEntries(rosterIds.map((id) => [id, mark]))
}

export function countMarks(
  rosterIds: readonly string[],
  marks: Marks,
): { present: number; absent: number; total: number } {
  const present = rosterIds.filter((id) => marks[id] === 'present').length
  return { present, absent: rosterIds.length - present, total: rosterIds.length }
}

/** The `save_attendance` payload: one record per rostered player. */
export function toRecords(rosterIds: readonly string[], marks: Marks): SavedMark[] {
  return rosterIds.map((id) => ({ player_id: id, status: marks[id] ?? 'absent' }))
}

/** True when the screen differs from what is saved (or nothing was ever saved and anyone is marked present). */
export function hasChanges(
  rosterIds: readonly string[],
  marks: Marks,
  saved: readonly SavedMark[],
): boolean {
  const original = initialMarks(rosterIds, saved)
  return rosterIds.some((id) => marks[id] !== original[id])
}

/** Attendance rate as a whole percent (half up), or null when nothing was marked. */
export function attendanceRate(present: number, total: number): number | null {
  return total > 0 ? Math.round((present * 100) / total) : null
}
