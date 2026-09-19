import { expect, test } from '@playwright/test'
import { installMockApi } from './support/mock-api'

// The one spec where the service worker is allowed to run.
test.use({ serviceWorkers: 'allow' })

test.describe('installable app', () => {
  test('the manifest describes an installable, standalone app with the Ajyal icons', async ({
    page,
    request,
  }) => {
    await installMockApi(page, { as: null, lang: 'en' })
    await page.goto('/login')
    const href = await page.locator('link[rel=manifest]').getAttribute('href')
    expect(href).toBeTruthy()

    const manifest = await (await request.get(href!)).json()
    expect(manifest).toMatchObject({
      short_name: 'Ajyal',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#1860c8',
      lang: 'ar',
      dir: 'rtl',
    })
    expect(manifest.name).toContain('Ajyal Academy')
    expect(manifest.name).toContain('أكاديمية أجيال')

    const sizes = manifest.icons.map(
      (icon: { sizes: string; purpose?: string }) =>
        `${icon.sizes}${icon.purpose ? ` ${icon.purpose}` : ''}`,
    )
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']))
    for (const icon of manifest.icons as { src: string; type: string }[]) {
      const response = await request.get(icon.src)
      expect(response.ok(), icon.src).toBe(true)
      expect(response.headers()['content-type']).toContain(icon.type)
    }
  })

  test('Chrome finds nothing that stops it being installed', async ({ page, context }) => {
    await installMockApi(page, { as: null, lang: 'en' })
    await page.goto('/login')
    await page.evaluate(() => navigator.serviceWorker.ready)
    const cdp = await context.newCDPSession(page)
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[]
    }
    // A test browser always runs in a private context, which Chrome reports as "in-incognito"; that is the
    // browser, not the app.
    const problems = installabilityErrors
      .map((e) => e.errorId)
      .filter((id) => id !== 'in-incognito')
    expect(problems).toEqual([])
  })

  test('the app shell opens with no connection, and says it is offline', async ({
    page,
    context,
  }) => {
    await installMockApi(page, { as: null, lang: 'en' })
    await page.goto('/login')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // the worker takes control on the next load; wait until it does
    await page.reload()
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toHaveCount(0)
  })

  test('data requests are never cached by the service worker', async ({ page }) => {
    await installMockApi(page, { as: null, lang: 'en' })
    await page.goto('/login')
    await page.evaluate(() => navigator.serviceWorker.ready)
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys())
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
      return urls
    })
    expect(cached.length).toBeGreaterThan(0)
    expect(
      cached.filter(
        (url) => url.includes('supabase') || url.includes('/rest/v1') || url.includes('/auth/v1'),
      ),
    ).toEqual([])
  })
})
