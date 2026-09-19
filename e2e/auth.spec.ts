import { expect, test } from '@playwright/test'
import { LANGS, openApp, t } from './support/app'
import { ADMIN, COACH, PASSWORD, installMockApi } from './support/mock-api'

for (const lang of LANGS) {
  test.describe(`sign-in and guards (${lang})`, () => {
    test('an admin signs in and lands on the admin home', async ({ page }) => {
      await openApp(page, null, lang, '/')
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')

      await page.locator('input[name=email]').fill(ADMIN.email)
      await page.locator('input[name=password]').fill(PASSWORD)
      await page.getByRole('button', { name: t(lang, 'auth:submit') }).click()

      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo')
      // the admin's navigation has the money pages, the coach's does not
      await page.getByRole('button', { name: t(lang, 'nav:more') }).click()
      await expect(page.getByRole('link', { name: t(lang, 'nav:reports') })).toBeVisible()
    })

    test('a coach signs in and lands on the coach home', async ({ page }) => {
      await openApp(page, null, lang, '/login')
      await page.locator('input[name=email]').fill(COACH.email)
      await page.locator('input[name=password]').fill(PASSWORD)
      await page.getByRole('button', { name: t(lang, 'auth:submit') }).click()
      await expect(page).toHaveURL(/\/coach$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Khalid')
      await expect(page.getByRole('link', { name: t(lang, 'nav:reports') })).toHaveCount(0)
    })

    test('a wrong password is explained and nobody is signed in', async ({ page }) => {
      await openApp(page, null, lang, '/login')
      await page.locator('input[name=email]').fill(ADMIN.email)
      await page.locator('input[name=password]').fill('nope')
      await page.getByRole('button', { name: t(lang, 'auth:submit') }).click()
      await expect(page.getByRole('alert')).toHaveText(t(lang, 'auth:error.invalidCredentials'))
      await expect(page).toHaveURL(/\/login$/)
    })

    test('signing out from the phone menu goes back to the login screen and protected pages stay closed', async ({
      page,
    }) => {
      await openApp(page, COACH, lang, '/coach')
      await page.getByRole('button', { name: t(lang, 'nav:more') }).click()
      const menu = page.getByRole('dialog')
      await expect(menu).toContainText(COACH.full_name)
      await menu.getByRole('button', { name: t(lang, 'nav:signOut') }).click()
      await expect(page).toHaveURL(/\/login$/)
      await page.goto('/coach/players')
      await expect(page).toHaveURL(/\/login$/)
    })

    test('a coach cannot open the admin-only pages', async ({ page }) => {
      await openApp(page, COACH, lang, '/admin/reports')
      await expect(page).toHaveURL(/\/coach$/)
      await page.goto('/admin/expenses')
      await expect(page).toHaveURL(/\/coach$/)
    })

    test('the language choice survives a reload and flips the direction', async ({ page }) => {
      await openApp(page, null, lang, '/login')
      const other = lang === 'ar' ? 'en' : 'ar'
      await page.getByRole('button', { name: t(lang, 'common:language.switchTo') }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', other)
      await expect(page.locator('html')).toHaveAttribute('dir', other === 'ar' ? 'rtl' : 'ltr')
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('lang', other)
    })

    test('a session the server no longer accepts ends with an explanation, not an error toast', async ({
      page,
    }) => {
      const api = await openApp(page, COACH, lang, '/coach')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Khalid')
      // From now on the server answers every data request as if the login had expired.
      await page.route('https://e2e.supabase.test/rest/v1/**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }),
        }),
      )
      await page
        .getByRole('link', { name: t(lang, 'nav:sessions') })
        .first()
        .click()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByText(t(lang, 'auth:sessionEnded'))).toBeVisible()
      expect(api.world.unmatched).toEqual([])
    })
  })
}

test('the mock rejects an unknown account too', async ({ page }) => {
  await installMockApi(page, { as: null, lang: 'en' })
  await page.goto('/login')
  await page.locator('input[name=email]').fill('someone@else.test')
  await page.locator('input[name=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})
