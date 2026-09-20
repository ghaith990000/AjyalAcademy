import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as applicationsApi from '@/features/applications/api'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import type * as registerApi from '@/features/register/api'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { Providers } from './providers'
import { routes } from './routes'

// These tests are about routing and the shells; the home screen (which reads from the database and listens for
// live updates) has its own tests, and tests never reach the network.
vi.mock('@/features/home/HomePage', () => ({
  default: ({ role }: { role: string }) => <h1>Home ({role})</h1>,
}))

// The shell counts the requests waiting (a badge on the menu); the registration form reads the locations.
vi.mock('@/features/applications/api', async (importOriginal) => ({
  ...(await importOriginal<typeof applicationsApi>()),
  countPendingApplications: vi.fn(async () => 0),
}))
vi.mock('@/features/register/api', async (importOriginal) => ({
  ...(await importOriginal<typeof registerApi>()),
  listPublicLocations: vi.fn(async () => []),
}))

function renderAt(path: string, auth: AuthState = fakeAuth('admin')) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </Providers>,
  )
  return router
}

describe('app routes and shells', () => {
  beforeEach(async () => {
    vi.mocked(applicationsApi.countPendingApplications).mockResolvedValue(0)
    await i18n.changeLanguage('ar')
  })

  it('redirects / to the login screen when signed out, in Arabic (RTL) by default', async () => {
    renderAt('/', fakeAuth(null))
    expect(await screen.findByRole('heading', { name: 'مرحباً بعودتك' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('switches the login screen to English (LTR) without a reload', async () => {
    renderAt('/login', fakeAuth(null))
    await userEvent.click(await screen.findByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
  })

  it('shows the admin navigation, including the overflow items', async () => {
    await i18n.changeLanguage('en')
    renderAt('/admin')
    const sidebar = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0]!
    for (const name of [
      'Home',
      'Players',
      'Subscriptions',
      'Sessions',
      'Registrations',
      'Coaches',
      'Discounts',
      'Expenses',
      'Reports',
      'Settings',
    ]) {
      expect(within(sidebar).getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('shows how many registration requests wait, on the menu entry and on the phone’s More tab', async () => {
    await i18n.changeLanguage('en')
    vi.mocked(applicationsApi.countPendingApplications).mockResolvedValue(3)
    renderAt('/admin')
    const sidebar = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0]!
    expect(
      await within(sidebar).findByRole('link', { name: 'Registrations 3 waiting' }),
    ).toHaveAttribute('href', '/admin/applications')
    expect(await screen.findByRole('button', { name: '3 waiting More' })).toBeInTheDocument()
  })

  it('shows no badge when nothing waits, and coaches never see the entry or ask for the count', async () => {
    await i18n.changeLanguage('en')
    vi.mocked(applicationsApi.countPendingApplications).mockClear()
    renderAt('/admin')
    const sidebar = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0]!
    expect(await within(sidebar).findByRole('link', { name: 'Registrations' })).toBeInTheDocument()
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument()
    document.body.innerHTML = ''

    vi.mocked(applicationsApi.countPendingApplications).mockClear()
    renderAt('/coach', fakeAuth('coach'))
    await screen.findAllByRole('navigation', { name: 'Main navigation' })
    expect(screen.queryByRole('link', { name: /Registrations/ })).not.toBeInTheDocument()
    expect(applicationsApi.countPendingApplications).not.toHaveBeenCalled()
  })

  it('shows only coach destinations for the coach area', async () => {
    await i18n.changeLanguage('en')
    renderAt('/coach/players', fakeAuth('coach'))
    const nav = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0]!
    expect(within(nav).getByRole('link', { name: 'My players' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Coaches' })).not.toBeInTheDocument()
  })

  it('lets a coach sign out on a phone, where the menu is the only place for it', async () => {
    await i18n.changeLanguage('en')
    const auth = fakeAuth('coach')
    renderAt('/coach', auth)
    await userEvent.click(await screen.findByRole('button', { name: 'More' }))
    const menu = await screen.findByRole('dialog', { name: 'More' })
    expect(within(menu).getByText('Khalid Al Dosari')).toBeInTheDocument()
    expect(within(menu).getByText('Coach')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('button', { name: 'Sign out' }))
    expect(auth.signOut).toHaveBeenCalledOnce()
  })

  it('opens the parents’ registration form without any sign-in, with the staff sign-in one tap away', async () => {
    await i18n.changeLanguage('en')
    const router = renderAt('/register', fakeAuth(null))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Register your child' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/register')
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('offers the registration form from the sign-in page', async () => {
    await i18n.changeLanguage('en')
    renderAt('/login', fakeAuth(null))
    await userEvent.click(await screen.findByRole('link', { name: 'Open the registration form' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Register your child' }),
    ).toBeInTheDocument()
  })

  it('renders a translated not-found page', async () => {
    renderAt('/nope')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'الصفحة غير موجودة' }),
    ).toBeInTheDocument()
  })

  it('shows the signed-in user and signs out from the shell', async () => {
    await i18n.changeLanguage('en')
    const auth = fakeAuth('admin')
    renderAt('/admin', auth)
    expect((await screen.findAllByText('Demo Admin')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!)
    expect(auth.signOut).toHaveBeenCalledOnce()
  })
})

describe('route guards', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('sends a signed-out visitor from any protected page to /login', async () => {
    for (const path of ['/admin', '/admin/coaches', '/coach']) {
      const router = renderAt(path, fakeAuth(null))
      expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      document.body.innerHTML = ''
    }
  })

  it('keeps a coach out of /admin and sends them to their own home', async () => {
    const router = renderAt('/admin/coaches', fakeAuth('coach'))
    expect(await screen.findAllByRole('navigation', { name: 'Main navigation' })).not.toHaveLength(
      0,
    )
    expect(router.state.location.pathname).toBe('/coach')
    expect(screen.queryByRole('link', { name: 'Coaches' })).not.toBeInTheDocument()
  })

  it('keeps a coach out of the expenses and reports pages', async () => {
    for (const path of ['/admin/expenses', '/admin/reports']) {
      const router = renderAt(path, fakeAuth('coach'))
      // The reports route is lazy: the router loads its chunk (the charting library) before it renders anything,
      // which can take a moment on a loaded machine.
      await screen.findAllByRole('navigation', { name: 'Main navigation' }, { timeout: 10_000 })
      expect(router.state.location.pathname).toBe('/coach')
      expect(screen.queryByRole('heading', { name: 'Expenses' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Reports' })).not.toBeInTheDocument()
      document.body.innerHTML = ''
    }
  }, 20_000)

  it('keeps an admin out of /coach', async () => {
    const router = renderAt('/coach/players', fakeAuth('admin'))
    await screen.findAllByRole('navigation', { name: 'Main navigation' })
    expect(router.state.location.pathname).toBe('/admin')
  })

  it('sends signed-in users away from /login and / to their home', async () => {
    const admin = renderAt('/login', fakeAuth('admin'))
    await screen.findAllByRole('navigation', { name: 'Main navigation' })
    expect(admin.state.location.pathname).toBe('/admin')
    document.body.innerHTML = ''

    const coach = renderAt('/', fakeAuth('coach'))
    await screen.findAllByRole('navigation', { name: 'Main navigation' })
    expect(coach.state.location.pathname).toBe('/coach')
  })

  it('shows a loading state, not the login screen, while the session is being restored', async () => {
    renderAt('/admin', fakeAuth(null, { status: 'loading' }))
    // (a page loaded on demand may show its own "Loading…" first; the account message follows or replaces it)
    expect(await screen.findByText('Loading your account…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
  })

  it('offers a retry when the profile could not be loaded', async () => {
    const auth = fakeAuth(null, { status: 'error' })
    renderAt('/admin', auth)
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(auth.retry).toHaveBeenCalledOnce()
  })
})
