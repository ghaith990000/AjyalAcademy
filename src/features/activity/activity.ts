/**
 * Turns an `activity_log` row into what the feed shows: which sentence, its values, an optional detail line, an
 * icon and a tone. Pure and defensive — the `summary` is a snapshot written by the database, so a field may be
 * missing (an unassigned player has no coach) and an action from a newer version may not be known at all.
 */
import type { ParseKeys } from 'i18next'
import {
  ArrowLeftRight,
  Ban,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  CreditCard,
  HandCoins,
  MapPin,
  Pencil,
  Percent,
  Receipt,
  Trash2,
  UserCog,
  UserMinus,
  UserPen,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Json } from '@/lib/database.types'
import { formatDate, formatMonthYear, formatTime, isValidISODate } from '@/lib/dates'
import { formatPercent } from '@/lib/discounts'
import type { Language } from '@/lib/i18n'
import { formatBHD } from '@/lib/money'

export interface ActivityRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: Json
  created_at: string
}

// ---------------------------------------------------------------------------
// Filters (chips above the feed) — grouped by what the entry is about
// ---------------------------------------------------------------------------

export const ACTIVITY_FILTERS = [
  'all',
  'player',
  'subscription',
  'payment',
  'session',
  'expense',
  'other',
] as const
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]

/** `entity_type` values behind each chip (attendance belongs with sessions; discounts, coaches and locations are "other"). */
export const FILTER_ENTITY_TYPES: Record<Exclude<ActivityFilter, 'all'>, readonly string[]> = {
  player: ['player'],
  subscription: ['subscription'],
  payment: ['payment'],
  session: ['session', 'attendance'],
  expense: ['expense'],
  other: ['discount', 'coach', 'location'],
}

/** A coach can only ever have done these things, so the other chips would always be empty. */
export const COACH_ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  'all',
  'player',
  'subscription',
  'payment',
  'session',
]

// ---------------------------------------------------------------------------
// Look of each action
// ---------------------------------------------------------------------------

export type ActivityTone = 'blue' | 'pink' | 'success' | 'warning' | 'danger'

interface ActionLook {
  icon: LucideIcon
  tone: ActivityTone
}

const LOOKS = {
  'player.created': { icon: UserPlus, tone: 'success' },
  'player.updated': { icon: UserPen, tone: 'blue' },
  'player.removed': { icon: UserMinus, tone: 'danger' },
  'player.reassigned': { icon: ArrowLeftRight, tone: 'blue' },
  'subscription.created': { icon: CreditCard, tone: 'pink' },
  'subscription.cancelled': { icon: Ban, tone: 'danger' },
  'subscription.location_changed': { icon: MapPin, tone: 'blue' },
  'payment.recorded': { icon: HandCoins, tone: 'success' },
  'discount.created': { icon: Percent, tone: 'pink' },
  'session.created': { icon: CalendarPlus, tone: 'blue' },
  'session.cancelled': { icon: CalendarX, tone: 'danger' },
  'attendance.saved': { icon: ClipboardCheck, tone: 'success' },
  'expense.created': { icon: Receipt, tone: 'warning' },
  'expense.updated': { icon: Pencil, tone: 'warning' },
  'expense.deleted': { icon: Trash2, tone: 'danger' },
  'expense.salaries_generated': { icon: Wallet, tone: 'warning' },
  'coach.created': { icon: UserCog, tone: 'blue' },
  'location.created': { icon: MapPin, tone: 'blue' },
  'location.updated': { icon: MapPin, tone: 'blue' },
} as const satisfies Record<string, ActionLook>

export type KnownAction = keyof typeof LOOKS

const FALLBACK_LOOK: ActionLook = { icon: Pencil, tone: 'blue' }

const isKnown = (action: string): action is KnownAction => action in LOOKS

/** Every action the app writes — the sentence tests loop over this list. */
export const KNOWN_ACTIONS = Object.keys(LOOKS) as KnownAction[]

// ---------------------------------------------------------------------------
// Reading the snapshot
// ---------------------------------------------------------------------------

type Summary = Record<string, unknown>

function summaryOf(value: Json): Summary {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
}

function text(summary: Summary, key: string): string | null {
  const value = summary[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function count(summary: Summary, key: string): number | null {
  const value = summary[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function list(summary: Summary, key: string): string[] {
  const value = summary[key]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : []
}

/** Already-translated words the sentences fall back to when the snapshot lacks a value. */
export interface ActivityLabels {
  someone: string
  player: string
  coach: string
  noCoach: string
  plan: (code: string) => string
  category: (category: string) => string
}

const DASH = '—'

export interface ActivityView {
  /** i18n key (namespace `activity`) of the sentence; its `<b>`, `<m>` and `<d>` tags are rendered by the item. */
  sentence: ParseKeys<'activity'>
  values: Record<string, string>
  detail: { key: ParseKeys<'activity'>; values: Record<string, string> } | null
  /** Who did it, for the avatar. */
  actor: string
  icon: LucideIcon
  tone: ActivityTone
}

/** BD amounts and dates from the snapshot, or a dash when they are missing or malformed. */
function money(fils: number | null, language: Language): string {
  return fils === null ? DASH : formatBHD(fils, language)
}

function day(value: string | null): string {
  return value !== null && isValidISODate(value.slice(0, 10))
    ? formatDate(value.slice(0, 10))
    : DASH
}

function clock(value: string | null, language: Language): string {
  return value !== null && /^\d{2}:\d{2}/.test(value)
    ? formatTime(value.slice(0, 5), language)
    : DASH
}

function people(names: string[], fallback: string, language: Language): string {
  if (names.length === 0) return fallback
  const locale = language === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB'
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
}

export function describeActivity(
  row: ActivityRow,
  language: Language,
  labels: ActivityLabels,
): ActivityView {
  const s = summaryOf(row.summary)
  const actor = text(s, 'actor_name') ?? labels.someone
  const look = isKnown(row.action) ? LOOKS[row.action] : FALLBACK_LOOK
  const view = (
    sentence: ActivityView['sentence'],
    values: Record<string, string>,
    detail: ActivityView['detail'] = null,
  ): ActivityView => ({ sentence, values: { actor, ...values }, detail, actor, ...look })

  const player = text(s, 'player_name') ?? labels.player
  const coach = text(s, 'coach_name')
  const players = people(list(s, 'player_names'), labels.player, language)

  switch (row.action) {
    case 'player.created':
      return coach
        ? view('action.player.created', { player, coach })
        : view('action.player.createdNoCoach', { player })
    case 'player.updated':
      return view('action.player.updated', { player })
    case 'player.removed':
      return view('action.player.removed', { player })
    case 'player.reassigned':
      return view('action.player.reassigned', {
        player,
        from: text(s, 'from_coach_name') ?? labels.noCoach,
        to: text(s, 'to_coach_name') ?? labels.noCoach,
      })
    case 'subscription.created': {
      const plan = text(s, 'plan')
      const location = text(s, 'location_name')
      return view(
        'action.subscription.created',
        {
          plan: plan ? labels.plan(plan) : DASH,
          players,
          total: money(count(s, 'total_fils'), language),
        },
        location ? { key: 'detail.location', values: { location } } : null,
      )
    }
    case 'subscription.location_changed': {
      const from = text(s, 'from_location_name')
      return view(
        'action.subscription.location_changed',
        { players, location: text(s, 'to_location_name') ?? DASH },
        from
          ? { key: 'detail.locationWas', values: { location: from } }
          : { key: 'detail.locationWasNone', values: {} },
      )
    }
    case 'subscription.cancelled': {
      const reason = text(s, 'reason')
      return view(
        'action.subscription.cancelled',
        { players },
        reason ? { key: 'detail.reason', values: { reason } } : null,
      )
    }
    case 'payment.recorded': {
      const balance = count(s, 'balance_fils')
      return view(
        'action.payment.recorded',
        { amount: money(count(s, 'amount_fils'), language), players },
        balance === null
          ? null
          : balance > 0
            ? { key: 'detail.balance', values: { amount: money(balance, language) } }
            : { key: 'detail.paidInFull', values: {} },
      )
    }
    case 'discount.created': {
      const value = count(s, 'value')
      const percent = text(s, 'discount_type') === 'percent'
      return view('action.discount.created', {
        name: text(s, 'discount_name') ?? text(s, 'code') ?? DASH,
        value: value === null ? DASH : percent ? formatPercent(value) : formatBHD(value, language),
      })
    }
    case 'session.created': {
      const location = text(s, 'location_name')
      return view(
        'action.session.created',
        {
          coach: coach ?? labels.coach,
          date: day(text(s, 'session_date')),
          time: clock(text(s, 'start_time'), language),
        },
        location ? { key: 'detail.location', values: { location } } : null,
      )
    }
    case 'session.cancelled':
      return view('action.session.cancelled', {
        coach: coach ?? labels.coach,
        date: day(text(s, 'session_date')),
      })
    case 'attendance.saved':
      return view('action.attendance.saved', {
        coach: coach ?? labels.coach,
        date: day(text(s, 'session_date')),
        present: String(count(s, 'present_count') ?? DASH),
        total: String(count(s, 'total_count') ?? DASH),
      })
    case 'expense.created':
    case 'expense.updated':
    case 'expense.deleted': {
      const category = text(s, 'category')
      return view(`action.${row.action}`, {
        category: category ? labels.category(category) : DASH,
        amount: money(count(s, 'amount_fils'), language),
      })
    }
    case 'expense.salaries_generated': {
      const month = text(s, 'month')
      return view('action.expense.salaries_generated', {
        month:
          month && isValidISODate(month.slice(0, 10))
            ? formatMonthYear(Number(month.slice(0, 4)), Number(month.slice(5, 7)), language)
            : DASH,
        n: String(count(s, 'created_count') ?? DASH),
        total: money(count(s, 'created_fils'), language),
      })
    }
    case 'coach.created':
      return view('action.coach.created', { coach: coach ?? labels.coach })
    case 'location.created':
      return view('action.location.created', { location: text(s, 'location_name') ?? DASH })
    case 'location.updated': {
      const name = text(s, 'location_name') ?? DASH
      const previous = text(s, 'previous_name')
      return view(
        'action.location.updated',
        { location: name },
        s.active === false
          ? { key: 'detail.switchedOff', values: {} }
          : previous && previous !== name
            ? { key: 'detail.renamedFrom', values: { location: previous } }
            : null,
      )
    }
    default:
      return view('action.unknown', {})
  }
}
