import { expect, test } from '@playwright/test'
import { LANGS, expectMobileLayout, openApp, t } from './support/app'
import { ADMIN, COACH, activityRow, TODAY } from './support/mock-api'

for (const lang of LANGS) {
  test.describe(`main flows (${lang})`, () => {
    test('a coach adds a player and lands on their page', async ({ page }) => {
      const api = await openApp(page, COACH, lang, '/coach/players')
      await page
        .getByRole('button', { name: t(lang, 'players:add') })
        .first()
        .click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(t(lang, 'players:form.fullName.label')).fill('Fahad Al Mannai')
      await dialog.getByLabel(t(lang, 'players:form.cpr.label')).fill('150312345')
      await dialog.getByLabel(t(lang, 'players:form.dob.label')).fill('2016-02-10')
      await dialog.getByLabel(t(lang, 'players:form.phone.label')).fill('39123456')
      await dialog.getByRole('button', { name: t(lang, 'players:form.submitCreate') }).click()

      await expect(page).toHaveURL(/\/coach\/players\/p-new-\d+$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Fahad Al Mannai')
      const post = api.world.calls.find((c) => c.method === 'POST' && c.path === 'players')
      expect(post?.body).toMatchObject({
        full_name: 'Fahad Al Mannai',
        cpr: '150312345',
        date_of_birth: '2016-02-10',
        phone: '39123456',
      })
      expect(post?.body).not.toHaveProperty('coach_id') // the database makes a coach's own player theirs
      await expectMobileLayout(page, 'new player page')
    })

    test('a coach creates a subscription for a returning player and pays in full', async ({
      page,
    }) => {
      const api = await openApp(page, COACH, lang, '/coach/players/p5')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Zayed Nasser')
      await page
        .getByRole('link', { name: t(lang, 'subscriptions:add') })
        .first()
        .click()
      await expect(page).toHaveURL(/\/coach\/subscriptions\/new\?player=p5$/)

      // dates → options → discount → summary → payment
      for (let step = 0; step < 4; step++) {
        await page.getByRole('button', { name: t(lang, 'subscriptions:wizard.next') }).click()
      }
      await page.getByRole('button', { name: t(lang, 'subscriptions:wizard.create') }).click()

      await expect(page).toHaveURL(/\/coach\/subscriptions\/s-new-\d+$/)
      const rpc = api.world.calls.find((c) => c.path === 'rpc/create_subscription')
      expect(rpc?.body).toMatchObject({
        p_players: [expect.objectContaining({ player_id: 'p5' })],
        p_location_id: 'loc-1', // offered from the player's own location
        p_initial_payment_fils: 20_000, // a solo plan for a returning player: no T-shirt fee
      })
      await expectMobileLayout(page, 'new subscription page')
    })

    test('a coach takes attendance for today and it is saved for the whole roster', async ({
      page,
    }) => {
      const api = await openApp(page, COACH, lang, '/coach/sessions/se2/attendance')
      const rows = page.locator('button[aria-pressed]')
      await expect(rows).toHaveCount(6)
      await rows.nth(0).click()
      await rows.nth(2).click()
      await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'true')
      await expectMobileLayout(page, 'attendance screen')

      await page.getByRole('button', { name: t(lang, 'attendance:save') }).click()
      await expect(page).toHaveURL(/\/coach\/sessions\/se2$/)
      const rpc = api.world.calls.find((c) => c.path === 'rpc/save_attendance')
      const body = rpc?.body as {
        p_session_id: string
        p_records: { player_id: string; status: string }[]
      }
      expect(body.p_session_id).toBe('se2')
      expect(body.p_records).toHaveLength(6)
      expect(body.p_records.filter((r) => r.status === 'present')).toHaveLength(2)
    })

    test('a session in the future cannot be marked', async ({ page }) => {
      await openApp(page, COACH, lang, '/coach/sessions/se3/attendance')
      await expect(page.getByText(t(lang, 'attendance:future.title'))).toBeVisible()
      await expect(page.locator('button[aria-pressed]')).toHaveCount(0)
    })

    test('the admin reports load: this month, and the year with its chart', async ({ page }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/reports')
      const kpis = page.getByRole('region', { name: t(lang, 'reports:kpi.label') })
      await expect(kpis).toContainText(t(lang, 'reports:kpi.collected'))
      await expect(kpis).toContainText(lang === 'ar' ? 'د.ب' : 'BD')
      await page.getByRole('button', { name: t(lang, 'reports:period.year'), exact: true }).click()
      await expect(page.locator('main [role=img] svg.recharts-surface')).toBeVisible()
      await expect(
        page.getByRole('table', { name: t(lang, 'reports:months.caption') }),
      ).toBeVisible()
      expect(api.world.calls.some((c) => c.path === 'rpc/revenue_by_month')).toBe(true)
      await expectMobileLayout(page, 'reports')
    })

    test('the admin reports split the money by location, and one location can be picked', async ({
      page,
    }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/reports')
      const table = page.getByRole('table', { name: t(lang, 'reports:locations.caption') })
      await expect(table).toBeVisible()
      await expect(table).toContainText('ملعب حديقة الرفاع')
      await expect(table).toContainText('Hamad City Field')
      await expect(table).toContainText(t(lang, 'reports:locations.none'))
      await expectMobileLayout(page, 'reports by location')

      await page
        .getByLabel(t(lang, 'locations:filter.label'), { exact: true })
        .selectOption({ label: 'Hamad City Field' })
      await expect(page.getByText(t(lang, 'reports:locationNote'))).toBeVisible()
      await expect(table).toBeHidden() // one location: nothing to compare
      const call = api.world.calls.filter((c) => c.path === 'rpc/report_summary').at(-1)
      expect(call?.body).toMatchObject({ p_location_id: 'loc-2' })
    })

    test('an admin adds a location and the list shows it', async ({ page }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/locations')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page
        .getByRole('button', { name: t(lang, 'locations:add') })
        .first()
        .click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(t(lang, 'locations:form.name.label')).fill('Isa Town Field')
      await dialog.getByRole('button', { name: t(lang, 'locations:form.submitCreate') }).click()
      await expect(page.getByText('Isa Town Field').last()).toBeVisible()
      const post = api.world.calls.find((c) => c.method === 'POST' && c.path === 'locations')
      expect(post?.body).toEqual({ name: 'Isa Town Field', address: null, active: true })
      await expectMobileLayout(page, 'locations')
    })

    test('a new activity entry appears on the admin home without a refresh', async ({ page }) => {
      const api = await openApp(page, ADMIN, lang, '/admin')
      await expect(page.getByText(t(lang, 'activity:live'), { exact: true })).toBeVisible() // the live connection is up
      await api.pushActivity(
        activityRow('player.created', COACH, {
          player_name: 'Live Player Fahad',
          coach_name: COACH.full_name,
        }),
      )
      await expect(page.getByText('Live Player Fahad')).toBeVisible({ timeout: 2_000 })
      await expect(page.locator('main ul.divide-y > li').first()).toContainText(COACH.full_name)
    })

    test("today's sessions on the coach home lead straight to attendance", async ({ page }) => {
      await openApp(page, COACH, lang, '/coach')
      const link = page.getByRole('link', { name: t(lang, 'home:sessions.takeAttendance') }).first()
      await expect(link).toHaveAttribute('href', `/coach/sessions/se1/attendance`)
      await link.click()
      await expect(page).toHaveURL(new RegExp(`/coach/sessions/se1/attendance$`))
      expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
}
