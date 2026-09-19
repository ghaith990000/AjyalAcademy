import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { Providers } from './providers'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
}

describe('app routes and shells', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar')
  })

  it('redirects / to the login screen, in Arabic (RTL) by default', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'مرحباً بعودتك' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('switches the login screen to English (LTR) without a reload', async () => {
    renderAt('/login')
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
    renderAt('/coach/players')
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
})
