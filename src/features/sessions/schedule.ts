import { addDays, format, parseISO } from 'date-fns'
import { todayISO } from '@/lib/dates'

export const SESSION_STATUSES = ['upcoming', 'done', 'cancelled'] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export interface TimeSlot {
  /** "yyyy-MM-dd" */
  session_date: string
  /** "HH:mm" (a form input) or "HH:mm:ss" (Postgres) */
  start_time: string
  end_time: string
}

/** "16:30:00" → "16:30". */
export const hhmm = (time: string): string => time.slice(0, 5)

/** Minutes since midnight of an "HH:mm[:ss]" time. */
export function minutesOf(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/** `count` dates a week apart, starting at `firstDate` (used by "repeat weekly"). */
export function weeklyDates(firstDate: string, count: number): string[] {
  const first = parseISO(firstDate)
  return Array.from({ length: count }, (_, index) =>
    format(addDays(first, index * 7), 'yyyy-MM-dd'),
  )
}

/** Two sessions clash when they are on the same day and their time ranges overlap (touching ends do not). */
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return (
    a.session_date === b.session_date &&
    minutesOf(a.start_time) < minutesOf(b.end_time) &&
    minutesOf(b.start_time) < minutesOf(a.end_time)
  )
}

/** The `existing` sessions that overlap at least one of the `candidates`. */
export function findConflicts<T extends TimeSlot>(candidates: TimeSlot[], existing: T[]): T[] {
  return existing.filter((session) => candidates.some((candidate) => overlaps(candidate, session)))
}

/**
 * The badge: upcoming = not cancelled and not over yet (a session in progress still counts); done = its end
 * time has passed. The list's "done" filter uses the same rule (`doneFilter`).
 */
export function sessionStatus(
  session: TimeSlot & { cancelled_at: string | null },
  now: Date = new Date(),
): SessionStatus {
  if (session.cancelled_at) return 'cancelled'
  const today = todayISO(now)
  if (session.session_date > today) return 'upcoming'
  if (session.session_date < today) return 'done'
  return minutesOf(session.end_time) > now.getHours() * 60 + now.getMinutes() ? 'upcoming' : 'done'
}

/**
 * Attendance can be taken from the session's day on — never for a cancelled session or one dated in the future
 * (the database refuses both; this only decides what the screens offer). Uses the browser's date, as D-047.
 */
export function canTakeAttendance(
  session: { session_date: string; cancelled_at: string | null },
  now: Date = new Date(),
): boolean {
  return !session.cancelled_at && session.session_date <= todayISO(now)
}

/** PostgREST `or(...)` expression for the not-cancelled sessions that are over at `now`. */
export function doneFilter(now: Date = new Date()): string {
  const today = todayISO(now)
  const time = `${format(now, 'HH:mm')}:00`
  return `session_date.lt.${today},and(session_date.eq.${today},end_time.lte.${time})`
}

/** Consecutive sessions on the same day, in the order given — the agenda's day headings. */
export function groupByDate<T extends { session_date: string }>(
  rows: readonly T[],
): { date: string; sessions: T[] }[] {
  const groups: { date: string; sessions: T[] }[] = []
  for (const row of rows) {
    const last = groups.at(-1)
    if (last && last.date === row.session_date) last.sessions.push(row)
    else groups.push({ date: row.session_date, sessions: [row] })
  }
  return groups
}
