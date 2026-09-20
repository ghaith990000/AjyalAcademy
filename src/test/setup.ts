import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'
import type * as locationsApi from '@/features/locations/api'

// Pages are loaded lazily; the first import of a big page under a busy machine can take longer than the 1s default.
configure({ asyncUtilTimeout: 5000 })

// jsdom lacks ResizeObserver, which Radix primitives (Switch, Select, …) use to measure themselves.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Locations are read by most screens (selects and filters). Every test gets the same three by default; a test
// that cares overrides `listLocations`. `vi.fn(impl)` keeps `impl` across `vi.resetAllMocks()`.
vi.mock('@/features/locations/api', async (importOriginal) => {
  const { LOCATIONS } = await import('./locations')
  return {
    ...(await importOriginal<typeof locationsApi>()),
    listLocations: vi.fn(async () => LOCATIONS),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
  }
})
