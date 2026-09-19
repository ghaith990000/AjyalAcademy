import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { Providers } from './providers'
import { routes } from './routes'

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
      'Coaches',
      'Discounts',
      'Expenses',
      'Reports',
      'Settings',
    ]) {
      expect(within(sidebar).getByRole('link', { name })).toBeInTheDocument()
    }
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

  it('renders a translated not-found page', async () => {
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument()
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
    expect(await screen.findByRole('status')).toHaveTextContent('Loading your account')
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
  })

  it('offers a retry when the profile could not be loaded', async () => {
    const auth = fakeAuth(null, { status: 'error' })
    renderAt('/admin', auth)
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(auth.retry).toHaveBeenCalledOnce()
  })
})
