import type { LocationRow } from '@/features/locations/api'

let counter = 0

/** A `locations` row (active, no address). */
export function fakeLocation(overrides: Partial<LocationRow> = {}): LocationRow {
  counter += 1
  return {
    id: `loc-x${counter}`,
    name: `Location ${counter}`,
    address: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** What every test sees as the academy's locations unless it says otherwise (see `setup.ts`). */
export const LOCATIONS: LocationRow[] = [
  fakeLocation({ id: 'loc-1', name: 'Al-Rifa' }),
  fakeLocation({ id: 'loc-2', name: 'Hamad City' }),
  fakeLocation({ id: 'loc-3', name: 'Old Field', active: false }),
]
