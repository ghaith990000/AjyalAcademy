import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import * as activityHooks from '@/features/activity/hooks'
import i18n from '@/lib/i18n'
import { fakeApplication } from '@/test/applications'
import * as api from './api'
import ApplicationsPage from './ApplicationsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listApplications: vi.fn(),
  countPendingApplications: vi.fn(),
}))
vi.mock('@/features/activity/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof activityHooks>()),
  useActivityRealtime: vi.fn(),
}))

const noor = fakeApplication({
  id: 'a-noor',
  full_name: 'Noor Al Mahmood',
  guardian_name: 'Mona Al Mahmood',
  phone: '3900 1234',
  date_of_birth: '2014-03-12',
})
const omar = fakeApplication({
  id: 'a-omar',
  full_name: 'Omar Hassan',
  guardian_name: 'Hassan Ali',
  location_id: null,
  location_name: null,
  existing_player_id: 'p-old',
  existing_player_name: 'Omar Hassan',
})

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/admin/applications', element: <ApplicationsPage /> },
      { path: '/admin/applications/:id', element: <p>detail page</p> },
    ],
    { initialEntries: ['/admin/applications'] },
  )
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

describe('ApplicationsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(activityHooks.useActivityRealtime).mockReturnValue(true)
    vi.mocked(api.countPendingApplications).mockResolvedValue(2)
    vi.mocked(api.listApplications).mockImplementation(async (status) => ({
      rows: status === 'pending' ? [noor, omar] : [],
      total: status === 'pending' ? 2 : 0,
    }))
  })

  it('opens on the requests waiting, with the child, the parent, the place and how long ago', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Registration requests' }),
    ).toBeInTheDocument()
    expect((await screen.findAllByText('Noor Al Mahmood')).length).toBeGreaterThan(0)
    expect(api.listApplications).toHaveBeenCalledWith('pending', 0)
    expect(screen.getAllByText('Mona Al Mahmood').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3900 1234').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Al-Rifa').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No location').length).toBeGreaterThan(0)
    // the count of waiting requests is on the filter
    expect(screen.getByRole('button', { name: 'Waiting (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
  })

  it('flags a request whose CPR already belongs to a player', async () => {
    renderPage()
    await screen.findAllByText('Omar Hassan')
    expect(screen.getAllByText('Check CPR')).toHaveLength(2) // table + phone card
  })

  it('shows accepted and rejected requests under their own filter', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (status) => ({
      rows:
        status === 'accepted'
          ? [fakeApplication({ full_name: 'Sara Ali', status: 'accepted' })]
          : status === 'pending'
            ? [noor]
            : [],
      total: status === 'accepted' ? 1 : status === 'pending' ? 1 : 0,
    }))
    renderPage()
    await screen.findAllByText('Noor Al Mahmood')
    await userEvent.click(screen.getByRole('button', { name: 'Accepted' }))
    expect((await screen.findAllByText('Sara Ali')).length).toBeGreaterThan(0)
    expect(api.listApplications).toHaveBeenCalledWith('accepted', 0)
    expect(screen.getAllByText('Accepted').length).toBeGreaterThan(1)

    await userEvent.click(screen.getByRole('button', { name: 'Rejected' }))
    expect(await screen.findByText('Nothing rejected')).toBeInTheDocument()
  })

  it('opens a request when its row is pressed', async () => {
    const router = renderPage()
    const rows = await screen.findAllByRole('row')
    await userEvent.click(
      within(rows.find((row) => row.textContent?.includes('Omar Hassan'))!).getByText(
        'Omar Hassan',
      ),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/applications/a-omar'))
  })

  it('explains an empty queue and offers the registration link', async () => {
    vi.mocked(api.countPendingApplications).mockResolvedValue(0)
    vi.mocked(api.listApplications).mockResolvedValue({ rows: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No requests waiting')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Copy registration link' }).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Waiting' })).toBeInTheDocument()
  })

  it('copies the public registration address', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listApplications).mockResolvedValue({ rows: [], total: 0 })
    renderPage()
    await user.click((await screen.findAllByRole('button', { name: 'Copy registration link' }))[0]!)
    expect(await screen.findByText('Link copied — paste it into a message')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/register`)
  })

  it('loads more when there are more than one page', async () => {
    const first = Array.from({ length: 20 }, (_, i) => fakeApplication({ full_name: `Kid ${i}` }))
    vi.mocked(api.listApplications).mockImplementation(async (_status, page) =>
      page === 0
        ? { rows: first, total: 21 }
        : { rows: [fakeApplication({ full_name: 'Kid last' })], total: 21 },
    )
    renderPage()
    await screen.findAllByText('Kid 0')
    expect(screen.getByText('Showing 20 of 21')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect((await screen.findAllByText('Kid last')).length).toBeGreaterThan(0)
    expect(api.listApplications).toHaveBeenCalledWith('pending', 1)
  })

  it('has a retry state', async () => {
    vi.mocked(api.listApplications).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load the requests")).toBeInTheDocument()
    vi.mocked(api.listApplications).mockResolvedValue({ rows: [noor], total: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Noor Al Mahmood')).length).toBeGreaterThan(0)
  })

  it('reads in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'طلبات التسجيل' })).toBeInTheDocument()
    expect((await screen.findAllByText('Noor Al Mahmood')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'قيد الانتظار (2)' })).toBeInTheDocument()
  })
})
