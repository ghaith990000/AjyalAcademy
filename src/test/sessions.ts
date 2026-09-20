import type { SessionAttendanceRow } from '@/features/attendance/api'
import type { SessionRow } from '@/features/sessions/api'
import { todayISO } from '@/lib/dates'

let counter = 0

/** A `training_sessions` row for today, 16:00–17:30, run by the fake coach (id `coach-1`). */
export function fakeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  counter += 1
  return {
    id: `sess${counter}`,
    session_date: todayISO(),
    start_time: '16:00:00',
    end_time: '17:30:00',
    coach_id: 'coach-1',
    location_id: 'loc-1',
    notes: null,
    cancelled_at: null,
    created_by: null,
    created_at: '2026-09-01T08:00:00Z',
    coach: { full_name: 'Khalid Al Dosari' },
    location: { name: 'Field 2' },
    ...overrides,
  }
}

/** A saved mark with the player's name embedded, as `getSessionAttendance` returns it. */
export function fakeMark(
  playerId: string,
  name: string | null,
  status: 'present' | 'absent',
): SessionAttendanceRow {
  return {
    player_id: playerId,
    status,
    marked_at: '2026-09-19T15:00:00Z',
    player: name === null ? null : { id: playerId, full_name: name },
  }
}

/** Dates far from "now", so status and grouping never depend on when the tests run. */
export const FUTURE = '2099-01-05'
export const FUTURE_NEXT_DAY = '2099-01-06'
export const PAST = '2020-01-05'
