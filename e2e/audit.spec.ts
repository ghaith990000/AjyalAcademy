import { expect, test, type Page } from '@playwright/test'
import { LANGS, expectAccessible, expectMobileLayout, openApp, t, type Lang } from './support/app'
import { ADMIN, COACH, type Person } from './support/mock-api'

/**
 * Every screen, both roles, both languages, at phone width: no sideways scroll, no tap target under 44px,
 * no WCAG 2.1 A/AA violation (axe), the right reading direction — and the mock API recognised every request
 * (so the sweep also notices a query nobody taught it).
 */
const ADMIN_ROUTES = [
  '/admin',
  '/admin/players',
  '/admin/players/p3',
  '/admin/subscriptions',
  '/admin/subscriptions/new',
  '/admin/subscriptions/s1',
  '/admin/sessions',
  '/admin/sessions/se2',
  '/admin/sessions/se2/attendance',
  '/admin/coaches',
  '/admin/discounts',
  '/admin/expenses',
  '/admin/reports',
  '/admin/settings',
]
const COACH_ROUTES = [
  '/coach',
  '/coach/players',
  '/coach/players/p1',
  '/coach/sessions',
  '/coach/sessions/se2',
  '/coach/sessions/se2/attendance',
  '/coach/subscriptions',
  '/coach/subscriptions/new',
  '/coach/subscriptions/s1',
]

/** The page has finished loading data: its skeletons are gone. */
async function settled(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
  await page.waitForTimeout(250)
}

for (const lang of LANGS) {
  const rtl = lang === 'ar'

  test.describe(`audit (${lang})`, () => {
    for (const [person, routes] of [
      [ADMIN, ADMIN_ROUTES],
      [COACH, COACH_ROUTES],
    ] as [Person, string[]][]) {
      for (const route of routes) {
        test(`${person.role} ${route}`, async ({ page }) => {
          const api = await openApp(page, person, lang, route)
          await expect(page.locator('main h1').first()).toBeVisible()
          await settled(page)

          await expect(page.locator('html')).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')
          await expect(page.locator('html')).toHaveAttribute('lang', lang)
          await expectMobileLayout(page, `${person.role} ${route}`)
          await expectAccessible(page, `${person.role} ${route}`)
          expect(api.world.unmatched, 'requests the mock API did not recognise').toEqual([])
        })
      }
    }

    test('the login screen', async ({ page }) => {
      await openApp(page, null, lang, '/login')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectMobileLayout(page, 'login', 'body')
      await expectAccessible(page, 'login')
    })

    test('a page that does not exist', async ({ page }) => {
      await openApp(page, ADMIN, lang, '/admin/nope')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectMobileLayout(page, 'not found', 'body')
      await expectAccessible(page, 'not found')
    })

    test('the phone menu', async ({ page }) => {
      await openApp(page, ADMIN, lang, '/admin')
      await settled(page)
      await page.getByRole('button', { name: t(lang, 'nav:more') }).click()
      await page.waitForTimeout(450) // the sheet slides in
      await expectMobileLayout(page, 'menu', '[role=dialog]')
      await expectAccessible(page, 'menu', '[role=dialog]')
    })

    test('the navigation reads from the right in Arabic and from the left in English', async ({
      page,
    }) => {
      await openApp(page, COACH, lang, '/coach')
      await settled(page)
      const tabs = page
        .getByRole('navigation', { name: t(lang, 'ui:mainNavigation') })
        .last()
        .getByRole('link')
      const first = await tabs.first().boundingBox()
      const last = await tabs.last().boundingBox()
      expect(first && last).toBeTruthy()
      // the first tab (Home) is at the start of the reading direction
      if (rtl) expect(first!.x).toBeGreaterThan(last!.x)
      else expect(first!.x).toBeLessThan(last!.x)
    })

    const dialogs: [Person, string, string, string][] = [
      [COACH, '/coach/players', 'players:add', 'add player (coach)'],
      [ADMIN, '/admin/players', 'players:add', 'add player (admin)'],
      [ADMIN, '/admin/sessions', 'sessions:add', 'schedule a session'],
      [ADMIN, '/admin/expenses', 'expenses:add', 'add an expense'],
      [ADMIN, '/admin/discounts', 'discounts:add', 'add a discount'],
      [ADMIN, '/admin/coaches', 'coaches:add', 'add a coach'],
    ]
    for (const [person, route, key, name] of dialogs) {
      test(`dialog: ${name}`, async ({ page }) => {
        const api = await openApp(page, person, lang, route)
        await expect(page.locator('main h1').first()).toBeVisible()
        await settled(page)
        await page
          .getByRole('button', { name: t(lang, key as never) })
          .first()
          .click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(450)
        await expectMobileLayout(page, name, '[role=dialog]')
        await expectAccessible(page, name, '[role=dialog]')
        expect(api.world.unmatched).toEqual([])
      })
    }
  })
}

export type { Lang }
