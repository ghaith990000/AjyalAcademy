import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * End-to-end tests run the production build (`vite preview`) in a real browser at phone width. The API is
 * always a mock (`e2e/support/mock-api.ts`) at a fake Supabase URL, so no real project is ever touched.
 * Locally the installed Chrome is used; in CI run `npx playwright install --with-deps chromium` first.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    channel: process.env.CI ? undefined : 'chrome',
    // The mock API sits in front of the network; a service worker would hide requests from it.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
})
