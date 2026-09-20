import type { ApplicationRow } from '@/features/applications/api'

let counter = 0

/** A registration request as the admin list reads it (pending, no warnings, sent from an Arabic form). */
export function fakeApplication(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  counter += 1
  return {
    id: `app-${counter}`,
    submission_id: `sub-${counter}`,
    guardian_name: 'Mona Al Mahmood',
    phone: '3900 1234',
    language: 'ar',
    location_id: 'loc-1',
    location_name: 'Al-Rifa',
    full_name: `Child ${counter}`,
    cpr: String(160000000 + counter),
    date_of_birth: '2015-03-12',
    address: 'Riffa, Block 901',
    school: 'Al Rifa Primary School',
    has_disease: false,
    disease_description: null,
    status: 'pending',
    created_at: '2026-10-19T08:00:00Z',
    decided_at: null,
    decided_by_name: null,
    decision_note: null,
    player_id: null,
    existing_player_id: null,
    existing_player_name: null,
    same_cpr_pending: 0,
    ...overrides,
  }
}
