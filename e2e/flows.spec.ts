import { expect, test, type Page } from '@playwright/test'
import { LANGS, expectMobileLayout, openApp, t } from './support/app'
import { ADMIN, COACH, activityRow, TODAY, type World } from './support/mock-api'

/** The registration form's text for child number `n` ("Child 2" / "الطفل 2"). */
const childTitle = (lang: 'ar' | 'en', n: number) =>
  t(lang, 'register:child.title').replace('{{n}}', String(n))

/** The page has finished loading data. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
}

/** A request the database would now hold, as the admin list reads it. */
function addWaitingRequest(world: World, name: string) {
  world.applications.unshift({
    ...world.applications[0]!,
    id: 'ap-live',
    full_name: name,
    cpr: '170312345',
    existing_player_id: null,
    existing_player_name: null,
    same_cpr_pending: 0,
    created_at: new Date().toISOString(),
  })
}

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

    test('a parent registers two children without signing in, and the request is sent once', async ({
      page,
    }) => {
      const api = await openApp(page, null, lang, '/register')
      await expect(page.getByRole('heading', { level: 1 })).toContainText(t(lang, 'register:title'))
      await page.getByLabel(t(lang, 'register:parent.name.label')).fill('Mona Al Mahmood')
      await page.getByLabel(t(lang, 'register:parent.phone.label')).fill('3900 1234')
      await page
        .getByLabel(t(lang, 'register:parent.location.label'))
        .selectOption({ label: 'Hamad City Field' })
      const fill = async (n: number, name: string, cpr: string) => {
        const card = page.getByRole('group', { name: childTitle(lang, n) })
        await card.getByLabel(t(lang, 'register:child.fullName.label')).fill(name)
        await card.getByLabel(t(lang, 'register:child.cpr.label')).fill(cpr)
        await card.getByLabel(t(lang, 'register:child.dob.label')).fill('2015-03-12')
      }
      await fill(1, 'Yousef Al Mahmood', '150312345')
      await page.getByRole('button', { name: t(lang, 'register:add.button') }).click()
      await fill(2, 'Noor Al Mahmood', '150312346')
      await page.getByRole('checkbox', { name: t(lang, 'register:confirm.label') }).check()
      await page.getByRole('button', { name: t(lang, 'register:submit') }).click()

      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        t(lang, 'register:done.title'),
      )
      await expect(page.getByRole('status')).toContainText('Yousef Al Mahmood')
      await expect(page.getByRole('status')).toContainText('Noor Al Mahmood')
      expect(api.world.submitAttempts).toHaveLength(1)
      expect(api.world.submitAttempts[0]).toMatchObject({
        p_guardian_name: 'Mona Al Mahmood',
        p_phone: '39001234',
        p_location_id: 'loc-2',
        p_language: lang,
        p_website: '',
        p_children: [
          expect.objectContaining({ full_name: 'Yousef Al Mahmood', cpr: '150312345' }),
          expect.objectContaining({ full_name: 'Noor Al Mahmood', cpr: '150312346' }),
        ],
      })
      await expectMobileLayout(page, 'registration thank-you', 'body')
    })

    test('a dropped connection keeps the parent’s answers, and sending again does not duplicate the request', async ({
      page,
    }) => {
      const api = await openApp(page, null, lang, '/register')
      await page.getByLabel(t(lang, 'register:parent.name.label')).fill('Mona')
      await page.getByLabel(t(lang, 'register:parent.phone.label')).fill('39001234')
      await page.getByLabel(t(lang, 'register:parent.location.label')).selectOption({ index: 1 })
      await page.getByLabel(t(lang, 'register:child.fullName.label')).fill('Noor')
      await page.getByLabel(t(lang, 'register:child.cpr.label')).fill('150312399')
      await page.getByLabel(t(lang, 'register:child.dob.label')).fill('2015-03-12')
      await page.getByRole('checkbox', { name: t(lang, 'register:confirm.label') }).check()

      api.world.failNextSubmit = 'offline'
      await page.getByRole('button', { name: t(lang, 'register:submit') }).click()
      await expect(page.getByRole('alert')).toContainText(
        t(lang, 'register:error.network').slice(0, 20),
      )
      await expect(page.getByLabel(t(lang, 'register:parent.name.label'))).toHaveValue('Mona')
      await expectMobileLayout(page, 'registration error', 'body')

      await page.getByRole('button', { name: t(lang, 'register:submit') }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        t(lang, 'register:done.title'),
      )
      expect(api.world.submitAttempts).toHaveLength(2)
      expect(api.world.submitAttempts[1]!.p_submission_id).toBe(
        api.world.submitAttempts[0]!.p_submission_id,
      )
      expect(api.world.applications.filter((a) => a.full_name === 'Noor')).toHaveLength(1)
    })

    test('an admin sees the waiting requests on the home screen and in the menu, and opens them', async ({
      page,
    }) => {
      await openApp(page, ADMIN, lang, '/admin')
      const card = page.getByRole('link', { name: t(lang, 'home:applications.title') })
      await expect(card).toContainText('3') // ap1, ap2, ap3 wait
      await expect(card).toHaveAttribute('href', '/admin/applications')
      await expect(
        page.getByRole('button', { name: new RegExp(t(lang, 'nav:more')) }).last(),
      ).toContainText('3')
      await card.click()
      await expect(page).toHaveURL(/\/admin\/applications$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        t(lang, 'applications:title'),
      )
    })

    test('a request that arrives while the list is open appears without a refresh', async ({
      page,
    }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/applications')
      await expect(page.getByText(t(lang, 'activity:live'))).toBeHidden() // (the live badge is on the home screen)
      await expect(page.locator('main').getByText('Ali Hassan').last()).toBeVisible()
      await settle(page)
      addWaitingRequest(api.world, 'Fahad Live Request')
      await api.pushActivity(
        activityRow('application.submitted', ADMIN, {
          guardian_name: 'Live Parent',
          child_names: ['Fahad Live Request'],
        }),
      )
      await expect(page.locator('main').getByText('Fahad Live Request').last()).toBeVisible({
        timeout: 5_000,
      })
    })

    test('an admin accepts a request: the player is created and the parent can be messaged on WhatsApp', async ({
      page,
    }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/applications/ap2')
      await page.getByRole('button', { name: t(lang, 'applications:detail.accept') }).click()
      const dialog = page.getByRole('dialog')
      await dialog
        .getByLabel(t(lang, 'applications:accept.coach.label'))
        .selectOption({ label: COACH.full_name })
      await dialog.getByRole('button', { name: t(lang, 'applications:accept.confirm') }).click()

      await expect(
        page.getByRole('heading', { name: t(lang, 'applications:decision.accepted') }),
      ).toBeVisible()
      const rpc = api.world.calls.find((c) => c.path === 'rpc/accept_player_application')
      expect(rpc?.body).toEqual({
        p_application_id: 'ap2',
        p_coach_id: COACH.id,
        p_location_id: null, // this request named none
      })
      const link = page.getByRole('link', { name: /WhatsApp|واتساب/ })
      const href = (await link.getAttribute('href'))!
      expect(href).toMatch(/^https:\/\/wa\.me\/97339001234\?text=/)
      // ap2 was sent from the Arabic form, so the message is Arabic whatever the admin reads
      expect(decodeURIComponent(href)).toContain('أكاديمية أجيال')
      await expectMobileLayout(page, 'accepted request')
    })

    test('an admin rejects a request with a note, and nothing is created', async ({ page }) => {
      const api = await openApp(page, ADMIN, lang, '/admin/applications/ap3')
      const before = api.world.players.length
      await page.getByRole('button', { name: t(lang, 'applications:detail.reject') }).click()
      const dialog = page.getByRole('dialog')
      await dialog
        .getByLabel(t(lang, 'applications:reject.note.label'))
        .fill('Under age for this group')
      await dialog.getByRole('button', { name: t(lang, 'applications:reject.confirm') }).click()

      await expect(
        page.getByRole('heading', { name: t(lang, 'applications:decision.rejected') }),
      ).toBeVisible()
      await expect(page.getByText('Under age for this group')).toBeVisible()
      expect(api.world.calls.find((c) => c.path === 'rpc/reject_player_application')?.body).toEqual(
        {
          p_application_id: 'ap3',
          p_note: 'Under age for this group',
        },
      )
      expect(api.world.players).toHaveLength(before)
    })

    test('accepting a child whose CPR already belongs to a player is refused, with a link to that player', async ({
      page,
    }) => {
      await openApp(page, ADMIN, lang, '/admin/applications/ap1')
      await page.getByRole('button', { name: t(lang, 'applications:detail.accept') }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: t(lang, 'applications:accept.confirm') }).click()
      await expect(dialog.getByRole('alert')).toContainText(
        t(lang, 'applications:accept.cprTaken').slice(0, 18),
      )
      await expect(
        dialog.getByRole('link', { name: t(lang, 'applications:accept.openExisting') }),
      ).toHaveAttribute('href', '/admin/players/p1')
      await expectMobileLayout(page, 'accept refused', '[role=dialog]')
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
