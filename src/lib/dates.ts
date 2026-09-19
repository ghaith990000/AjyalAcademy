import {
  addMonths,
  differenceInCalendarDays,
  differenceInYears,
  format,
  isValid,
  parseISO,
  subDays,
} from 'date-fns'
import type { Language } from './i18n'

const DATE_LOCALE: Record<Language, string> = { ar: 'ar-BH-u-nu-latn', en: 'en-GB' }
// Newer ICU inserts a narrow no-break space before AM/PM; normalize to a plain space.
const SPACE_LIKE = new RegExp(`[${String.fromCharCode(0x202f, 0x00a0)}]`, 'g')
const TIME_LOCALE: Record<Language, string> = { ar: 'ar-BH-u-nu-latn', en: 'en-US' }

function toDate(value: Date | string): Date {
  // Date-only ISO strings ("2026-09-19") must be read as local dates, not UTC.
  return typeof value === 'string' ? parseISO(value) : value
}

/** "19/09/2026" — same in both languages (Latin digits). */
export function formatDate(value: Date | string): string {
  return format(toDate(value), 'dd/MM/yyyy')
}

/** "Saturday 19 September" / "السبت 19 سبتمبر" — localized names, Latin digits. */
export function formatLongDate(value: Date | string, language: Language): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toDate(value))
}

/** "September 2026" / "سبتمبر 2026" — the month's name in the language, the year in Latin digits. */
export function formatMonthYear(year: number, month: number, language: Language): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[language], { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

/** "September" / "سبتمبر" (`long`), "Sep" (`short`) — for month rows and chart tooltips. */
export function formatMonthName(
  month: number,
  language: Language,
  style: 'long' | 'short' = 'long',
): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[language], { month: style }).format(
    new Date(2000, month - 1, 1),
  )
}

/** Formats a "HH:mm" (or Date) time: "4:30 PM" in English, "4:30 م" in Arabic. */
export function formatTime(value: string | Date, language: Language): string {
  let date: Date
  if (typeof value === 'string') {
    const [hours = '0', minutes = '0'] = value.split(':')
    date = new Date(2000, 0, 1, Number(hours), Number(minutes))
  } else {
    date = value
  }
  return new Intl.DateTimeFormat(TIME_LOCALE[language], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(SPACE_LIKE, ' ')
}

/**
 * "4:30 PM – 6:00 PM" / "4:30 م – 6:00 م". Render it inside a plain `<bdi>` (no forced `dir`): the Arabic
 * am/pm letters are right-to-left, and inside an LTR box the range comes out scrambled ("4:30 م 6:00 – م").
 */
export function formatTimeRange(start: string, end: string, language: Language): string {
  return `${formatTime(start, language)} – ${formatTime(end, language)}`
}

/** "in 3 days" / "tomorrow" / "خلال 3 أيام" / "غداً" — words from the platform, digits always Latin. */
export function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: Language,
): string {
  return new Intl.RelativeTimeFormat(DATE_LOCALE[language], { numeric: 'auto' }).format(value, unit)
}

/**
 * How long ago something happened: "now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago"
 * (`منذ 5 دقائق` …), and from a week on the plain date. `then` is an ISO timestamp; a moment slightly in the
 * future (clock skew between phone and server) reads as "now".
 */
export function formatTimeAgo(then: Date | string, now: Date, language: Language): string {
  const moment = typeof then === 'string' ? new Date(then) : then
  const seconds = Math.max(0, Math.round((now.getTime() - moment.getTime()) / 1000))
  if (seconds < 45) return formatRelative(0, 'second', language)
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return formatRelative(-minutes, 'minute', language)
  const hours = Math.round(minutes / 60)
  if (hours < 24 && differenceInCalendarDays(now, moment) === 0) {
    return formatRelative(-hours, 'hour', language)
  }
  const days = differenceInCalendarDays(now, moment)
  if (days < 7) return formatRelative(-days, 'day', language)
  return formatDate(moment)
}

/** Today (or `on`) as "yyyy-MM-dd" in local time — for comparing with date-only strings. */
export function todayISO(on: Date = new Date()): string {
  return format(on, 'yyyy-MM-dd')
}

/** True for a real calendar date written exactly as "yyyy-MM-dd" (rejects "2015-02-31", "15-1-1"). */
export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

/** Whole years between a date of birth and `on` (default: today). */
export function ageInYears(dateOfBirth: Date | string, on: Date = new Date()): number {
  return differenceInYears(on, toDate(dateOfBirth))
}

/** Default subscription end: start + 1 month − 1 day, inclusive (2026-10-01 → 2026-10-31, 10-15 → 11-14). */
export function defaultEndDate(startISO: string): string {
  return format(subDays(addMonths(parseISO(startISO), 1), 1), 'yyyy-MM-dd')
}
