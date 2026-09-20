import { expect, test } from '@playwright/test'
import { ADMIN, COACH, PASSWORD } from './support/mock-api'
import { openApp } from './support/app'

/**
 * The built app is served with a strict Content-Security-Policy (vite.config.ts → `preview.headers`; the same
 * policy is in vercel.json and netlify.toml). This fails if a screen ever needs something the policy forbids:
 * an inline script, another origin, a remote font.
 */
test.describe('content security policy', () => {
  test('the app is served with the policy', async ({ request }) => {
    const response = await request.get('/login')
    const csp = response.headers()['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('https://e2e.supabase.test')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
  })

  for (const [person, routes] of [
    [
      ADMIN,
      [
        '/admin',
        '/admin/players',
        '/admin/reports',
        '/admin/expenses',
        '/admin/sessions/se2/attendance',
      ],
    ],
    [COACH, ['/coach', '/coach/subscriptions/new']],
  ] as const) {
    test(`nothing is blocked while using the ${person.role} screens`, async ({ page }) => {
      const violations: string[] = []
      await page.exposeFunction('reportViolation', (text: string) => violations.push(text))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          void (window as unknown as { reportViolation: (t: string) => void }).reportViolation(
            `${event.violatedDirective} ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber}`,
          )
        })
      })
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' && /content security policy/i.test(message.text()))
          consoleErrors.push(message.text())
      })

      await openApp(page, person, 'en', routes[0])
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator('main h1').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
      }
      expect(violations).toEqual([])
      expect(consoleErrors).toEqual([])
    })
  }

  test('the parents’ registration form works under the policy, from opening it to sending it', async ({
    page,
  }) => {
    const violations: string[] = []
    await page.exposeFunction('reportViolation', (text: string) => violations.push(text))
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        void (window as unknown as { reportViolation: (t: string) => void }).reportViolation(
          `${event.violatedDirective} ${event.blockedURI}`,
        )
      })
    })
    const api = await openApp(page, null, 'en', '/register')
    await page.getByLabel('Your name').fill('Mona')
    await page.getByLabel('Phone number').fill('39001234')
    await page.getByLabel('Preferred location').selectOption({ index: 1 })
    await page.getByLabel("Child's full name").fill('Noor')
    await page.getByLabel('CPR number').fill('160312399')
    await page.getByLabel('Date of birth').fill('2015-03-12')
    await page.getByRole('checkbox', { name: /I confirm/ }).check()
    await page.getByRole('button', { name: 'Send registration' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
    expect(api.world.submitAttempts).toHaveLength(1)
    expect(violations).toEqual([])
  })

  test('signing in works under the policy (the auth requests are allowed)', async ({ page }) => {
    await openApp(page, null, 'en', '/login')
    await page.locator('input[name=email]').fill(ADMIN.email)
    await page.locator('input[name=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })
})
