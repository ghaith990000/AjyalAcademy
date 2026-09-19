import type { PlayerRow } from '@/features/players/api'

let counter = 0

/** A player row as the API returns it (with the embedded coach name). */
export function fakePlayer(overrides: Partial<PlayerRow> = {}): PlayerRow {
  counter += 1
  return {
    id: `p${counter}`,
    full_name: `Player ${counter}`,
    cpr: String(150000000 + counter),
    date_of_birth: '2015-03-12',
    address: 'Riffa, Block 901',
    school: 'Al Rifa Primary School',
    phone: '39111001',
    has_disease: false,
    disease_description: null,
    coach_id: 'c1',
    coach: { full_name: 'Khalid Al Dosari' },
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}
