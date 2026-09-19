import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Pages are loaded lazily; the first import of a big page under a busy machine can take longer than the 1s default.
configure({ asyncUtilTimeout: 5000 })

// jsdom lacks ResizeObserver, which Radix primitives (Switch, Select, …) use to measure themselves.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
