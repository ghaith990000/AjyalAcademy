import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { fakeSubscription } from '@/test/subscriptions'
import * as api from './api'
import SubscriptionsPage from './SubscriptionsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listSubscriptions: vi.fn(),
}))

const active = fakeSubscription({
  id: 'a',
  player_names: 'Yousef Al Mahmood',
  paid_fils: 25000,
  balance_fils: 0,
  status: 'active',
})
const expiring = fakeSubscription({
  id: 'e',
  plan_code: 'duo',
  player_names: 'Ali Hassan, Hamad Salman',
  player_count: 2,
  total_fils: 45000,
  paid_fils: 10000,
  balance_fils: 35000,
  status: 'expiring_soon',
  start_date: '2026-09-15',
  end_date: '2026-10-14',
})

function renderPage(role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/subscriptions`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <SubscriptionsPage /> },
      { path: `${prefix}/new`, element: <p>wizard page</p> },
      { path: `${prefix}/:id`, element: <p>detail page</p> },
    ],
    { initialEntries: [prefix] },
  )
  render(
    <Providers>
      <AuthContext.Provider value={fakeAuth(role)}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </Providers>,
  )
  return router
}
const lastFilters = () => vi.mocked(api.listSubscriptions).mock.lastCall![0]

describe('SubscriptionsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listSubscriptions).mockResolvedValue({ rows: [active, expiring], total: 2 })
  })

  it('lists subscriptions with players, plan, period, money and status', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Subscriptions' })).toBeInTheDocument()
    expect((await screen.findAllByText('Ali Hassan, Hamad Salman')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Duo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15/09/2026 – 14/10/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('45.000 BD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('35.000 BD').length).toBeGreaterThan(0) // balance owed
    expect(screen.getAllByText('Expiring soon').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByText('Showing 2 of 2')).toBeInTheDocument()
  })

  it('filters by status and searches by player after a pause', async () => {
    renderPage()
    await screen.findAllByText('Ali Hassan, Hamad Salman')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'expiring_soon')
    await waitFor(() => expect(lastFilters().status).toBe('expiring_soon'))
    await userEvent.type(screen.getByRole('searchbox'), 'ali')
    await waitFor(() => expect(lastFilters().search).toBe('ali'))
  })

  it('offers every status in the filter', async () => {
    renderPage()
    await screen.findAllByText('Ali Hassan, Hamad Salman')
    const options = screen.getByLabelText('Status').querySelectorAll('option')
    expect([...options].map((o) => o.textContent)).toEqual([
      'All statuses',
      'Active',
      'Expiring soon',
      'Upcoming',
      'Expired',
      'Cancelled',
    ])
  })

  it('shows a "no match" state and a way back when a filter finds nothing', async () => {
    renderPage()
    await screen.findAllByText('Ali Hassan, Hamad Salman')
    vi.mocked(api.listSubscriptions).mockResolvedValue({ rows: [], total: 0 })
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'expired')
    expect(await screen.findByText('No subscriptions match')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    expect(screen.getByLabelText('Status')).toHaveValue('all')
  })

  it('has an empty state with a "New subscription" action', async () => {
    vi.mocked(api.listSubscriptions).mockResolvedValue({ rows: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New subscription' }).length).toBeGreaterThan(1)
  })

  it('offers a retry when loading fails', async () => {
    vi.mocked(api.listSubscriptions).mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load subscriptions")).toBeInTheDocument()
    vi.mocked(api.listSubscriptions).mockResolvedValue({ rows: [active], total: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Yousef Al Mahmood')).length).toBeGreaterThan(0)
  })

  it("opens a subscription and starts a new one under the caller's own area", async () => {
    const admin = renderPage('admin')
    await userEvent.click((await screen.findAllByText('Yousef Al Mahmood'))[0]!)
    expect(admin.state.location.pathname).toBe('/admin/subscriptions/a')

    document.body.innerHTML = ''
    const coach = renderPage('coach')
    await userEvent.click((await screen.findAllByRole('button', { name: 'New subscription' }))[0]!)
    expect(coach.state.location.pathname).toBe('/coach/subscriptions/new')
  })

  it("tells a coach when a subscription also has another coach's players", async () => {
    vi.mocked(api.listSubscriptions).mockResolvedValue({
      rows: [fakeSubscription({ player_names: 'Ali Hassan', player_count: 3, plan_code: 'trio' })],
      total: 1,
    })
    renderPage('coach')
    expect((await screen.findAllByText('+2 with another coach')).length).toBeGreaterThan(0)
  })

  it('loads more on "Show more"', async () => {
    const page = Array.from({ length: 20 }, (_, i) =>
      fakeSubscription({ player_names: `Player ${i}` }),
    )
    vi.mocked(api.listSubscriptions).mockImplementation(async (_f, p) =>
      p === 0
        ? { rows: page, total: 21 }
        : { rows: [fakeSubscription({ player_names: 'Twenty First' })], total: 21 },
    )
    renderPage()
    expect(await screen.findByText('Showing 20 of 21')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Showing 21 of 21')).toBeInTheDocument()
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'الاشتراكات' })).toBeInTheDocument()
    expect((await screen.findAllByText('ينتهي قريباً')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('45.000 د.ب').length).toBeGreaterThan(0)
  })
})
