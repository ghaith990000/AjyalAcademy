import '@testing-library/jest-dom/vitest'

// jsdom lacks ResizeObserver, which Radix primitives (Switch, Select, …) use to measure themselves.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
