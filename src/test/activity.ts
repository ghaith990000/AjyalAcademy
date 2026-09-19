import type { ActivityRow, KnownAction } from '@/features/activity/activity'

let counter = 0

/** An `activity_log` row as the database writes it (the snapshot always carries `actor_name`). */
export function fakeActivity(
  action: string,
  summary: Record<string, unknown> = {},
  overrides: Partial<ActivityRow> = {},
): ActivityRow {
  counter += 1
  return {
    id: `act${counter}`,
    actor_id: 'admin-1',
    action,
    entity_type: action.split('.')[0]!,
    entity_id: null,
    summary: { actor_name: 'Demo Admin', ...summary } as ActivityRow['summary'],
    created_at: '2026-10-19T09:55:00+00:00',
    ...overrides,
  }
}

/** A realistic snapshot for every action the app writes (see the migrations for who writes what). */
export const SAMPLE_SUMMARIES: Record<KnownAction, Record<string, unknown>> = {
  'player.created': { player_name: 'Yousef Al Mahmood', coach_name: 'Khalid Al Dosari' },
  'player.updated': { player_name: 'Yousef Al Mahmood' },
  'player.removed': { player_name: 'Yousef Al Mahmood' },
  'player.reassigned': {
    player_name: 'Yousef Al Mahmood',
    from_coach_name: 'Khalid Al Dosari',
    to_coach_name: 'Sara Al Khalifa',
  },
  'subscription.created': {
    player_names: ['Ali Hassan', 'Omar Hassan'],
    plan: 'duo',
    total_fils: 35_000,
    discount_fils: 0,
  },
  'subscription.cancelled': {
    player_names: ['Ali Hassan'],
    reason: 'Moved away',
    total_fils: 20_000,
  },
  'payment.recorded': {
    subscription_id: 's1',
    amount_fils: 20_000,
    method: 'cash',
    paid_fils: 20_000,
    balance_fils: 15_000,
    player_names: ['Ali Hassan'],
  },
  'discount.created': {
    discount_name: 'Sibling discount',
    code: 'SIBLING10',
    discount_type: 'percent',
    value: 1250,
  },
  'session.created': {
    session_date: '2026-09-19',
    start_time: '16:00:00',
    end_time: '17:30:00',
    coach_name: 'Khalid Al Dosari',
  },
  'session.cancelled': { session_date: '2026-09-19', coach_name: 'Khalid Al Dosari' },
  'attendance.saved': {
    session_date: '2026-09-19',
    start_time: '16:00:00',
    coach_name: 'Khalid Al Dosari',
    present_count: 6,
    total_count: 8,
  },
  'expense.created': { category: 'field_rent', amount_fils: 50_000 },
  'expense.updated': { category: 'field_rent', amount_fils: 55_000, expense_date: '2026-10-15' },
  'expense.deleted': {
    category: 'transportation',
    amount_fils: 10_000,
    expense_date: '2026-10-31',
  },
  'expense.salaries_generated': { month: '2026-10-01', created_count: 2, created_fils: 250_000 },
  'coach.created': { coach_name: 'Sara Al Khalifa' },
}
