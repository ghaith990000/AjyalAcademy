import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import i18n from '@/lib/i18n'
import { fakeAuth, fakeProfile } from '@/test/auth'
import { FUTURE, FUTURE_NEXT_DAY, PAST, fakeSession } from '@/test/sessions'
import * as api from './api'
import SessionsPage from './SessionsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listSessions: vi.fn(),
  listCoachSessionsBetween: vi.fn(),
  createSessions: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const morning = fakeSession({
  id: 'a',
  session_date: FUTURE,
  start_time: '16:00:00',
  end_time: '17:30:00',
  location: 'Field 2',
})
const evening = fakeSession({
  id: 'b',
  session_date: FUTURE,
  start_time: '18:00:00',
  end_time: '19:00:00',
  location: null,
  coach: { full_name: 'Sara Al Khalifa' },
})
const nextDay = fakeSession({ id: 'c', session_date: FUTURE_NEXT_DAY })

function renderPage(role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/sessions`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <SessionsPage /> },
      { path: `${prefix}/:id`, element: <p>detail page</p> },
      { path: `${prefix}/:id/attendance`, element: <p>attendance page</p> },
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
const lastFilters = () => vi.mocked(api.listSessions).mock.lastCall![0]

describe('SessionsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listSessions).mockResolvedValue({ rows: [morning, evening, nextDay], total: 3 })
    vi.mocked(api.listCoachSessionsBetween).mockResolvedValue([])
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([
      fakeProfile('coach', { id: 'coach-1', full_name: 'Khalid Al Dosari' }),
      fakeProfile('coach', { id: 'coach-2', full_name: 'Sara Al Khalifa' }),
    ])
  })

  it('lists the agenda by day, each session with its times, place and status', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeInTheDocument()

    const days = await screen.findAllByRole('heading', { level: 2 })
    expect(days).toHaveLength(2)
    expect(days[0]).toHaveTextContent('05/01/2099')
    expect(days[1]).toHaveTextContent('06/01/2099')

    const firstDay = within(days[0]!.closest('section')!)
    expect(firstDay.getAllByRole('listitem')).toHaveLength(2)
    expect(firstDay.getByText('4:00 PM – 5:30 PM')).toBeInTheDocument()
    expect(firstDay.getByText('6:00 PM – 7:00 PM')).toBeInTheDocument()
    expect(firstDay.getByText('Field 2')).toBeInTheDocument()
    expect(screen.getAllByText('Upcoming')).toHaveLength(3) // one badge per session
    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument()
  })

  it('shows an admin who runs each session, but not a coach (they only see their own)', async () => {
    renderPage('admin')
    expect(await screen.findByText('Coach: Sara Al Khalifa')).toBeInTheDocument()
    expect(screen.getByLabelText('Coach')).toBeInTheDocument()
  })

  it('a coach sees no coach names and no coach filter', async () => {
    renderPage('coach')
    await screen.findAllByRole('heading', { level: 2 })
    expect(screen.queryByText(/^Coach:/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Coach')).not.toBeInTheDocument()
    expect(coachesApi.listCoaches).not.toHaveBeenCalled()
  })

  it('opens on "Today & upcoming" and filters by status and coach', async () => {
    renderPage()
    await screen.findAllByRole('heading', { level: 2 })
    expect(lastFilters()).toEqual({ status: 'upcoming', coachId: '' })

    const status = screen.getByLabelText('Show')
    expect([...status.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Today & upcoming',
      'Done',
      'Cancelled',
      'All sessions',
    ])
    await userEvent.selectOptions(status, 'done')
    await waitFor(() => expect(lastFilters().status).toBe('done'))

    await userEvent.selectOptions(screen.getByLabelText('Coach'), 'coach-2')
    await waitFor(() => expect(lastFilters()).toEqual({ status: 'done', coachId: 'coach-2' }))
  })

  it('offers attendance for sessions that have started, not for future or cancelled ones', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      rows: [
        fakeSession({ id: 'past', session_date: PAST }),
        fakeSession({ id: 'future', session_date: FUTURE }),
        fakeSession({ id: 'gone', session_date: PAST, cancelled_at: '2020-01-04T10:00:00Z' }),
      ],
      total: 3,
    })
    renderPage()
    const links = await screen.findAllByRole('link', { name: 'Attendance' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/admin/sessions/past/attendance')
    expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Done', { selector: 'span' })).toBeInTheDocument()
  })

  it('opens a session, and its attendance screen, from the agenda', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      rows: [fakeSession({ id: 'past', session_date: PAST })],
      total: 1,
    })
    const router = renderPage('coach')
    await userEvent.click(await screen.findByRole('link', { name: 'Attendance' }))
    expect(router.state.location.pathname).toBe('/coach/sessions/past/attendance')
    await router.navigate('/coach/sessions')
    await userEvent.click(await screen.findByText('4:00 PM – 5:30 PM'))
    expect(router.state.location.pathname).toBe('/coach/sessions/past')
  })

  it('pages with "Show more"', async () => {
    vi.mocked(api.listSessions).mockImplementation(async (_filters, page) =>
      page === 0
        ? { rows: [morning], total: 2 }
        : { rows: [fakeSession({ id: 'd', session_date: FUTURE_NEXT_DAY })], total: 2 },
    )
    renderPage()
    expect(await screen.findByText('Showing 1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Showing 2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('has an empty state with a "Schedule session" action', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({ rows: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No upcoming sessions')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Schedule session' }).length).toBeGreaterThan(1)
  })

  it('shows a "no match" state and a way back when a filter finds nothing', async () => {
    renderPage()
    await screen.findAllByRole('heading', { level: 2 })
    vi.mocked(api.listSessions).mockResolvedValue({ rows: [], total: 0 })
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'cancelled')
    expect(await screen.findByText('No sessions match')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    expect(screen.getByLabelText('Show')).toHaveValue('upcoming')
  })

  it('offers a retry when loading fails', async () => {
    vi.mocked(api.listSessions).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load sessions")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByRole('heading', { level: 2 })).length).toBe(2)
  })

  it('opens the scheduling form', async () => {
    renderPage()
    await screen.findAllByRole('heading', { level: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Schedule session' }))
    expect(await screen.findByRole('dialog', { name: 'Schedule a session' })).toBeInTheDocument()
  })

  it('shows the agenda in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'الحصص' })).toBeInTheDocument()
    expect(await screen.findAllByText('قادمة')).not.toHaveLength(0)
    const range = screen.getAllByText('4:00 م – 5:30 م')
    expect(range.length).toBeGreaterThan(0)
    // Arabic am/pm letters are right-to-left: a forced dir="ltr" would scramble the range ("4:00 م 5:30 – م").
    expect(range[0]!.tagName).toBe('BDI')
    expect(range[0]).not.toHaveAttribute('dir')
  })
})
