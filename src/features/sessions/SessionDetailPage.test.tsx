import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import * as attendanceApi from '@/features/attendance/api'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { FUTURE, PAST, fakeMark, fakeSession } from '@/test/sessions'
import * as api from './api'
import SessionDetailPage from './SessionDetailPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getSession: vi.fn(),
  cancelSession: vi.fn(),
  updateSession: vi.fn(),
  listCoachSessionsBetween: vi.fn(),
}))
vi.mock('@/features/attendance/api', async (importOriginal) => ({
  ...(await importOriginal<typeof attendanceApi>()),
  getSessionAttendance: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const session = fakeSession({
  id: 's1',
  session_date: FUTURE,
  start_time: '16:00:00',
  end_time: '17:30:00',
  location: 'Field 2',
  notes: 'Bring bibs',
})

function renderDetail(role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/sessions`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <p>sessions list</p> },
      { path: `${prefix}/:id`, element: <SessionDetailPage /> },
      { path: `${prefix}/:id/attendance`, element: <p>attendance screen</p> },
    ],
    { initialEntries: [`${prefix}/s1`] },
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

describe('SessionDetailPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.getSession).mockResolvedValue(session)
    vi.mocked(api.listCoachSessionsBetween).mockResolvedValue([])
    vi.mocked(attendanceApi.getSessionAttendance).mockResolvedValue([])
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([])
  })

  it('shows when, where, who runs it and the notes', async () => {
    renderDetail('admin')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/January/)
    expect(screen.getByText('4:00 PM – 5:30 PM')).toBeInTheDocument()
    expect(screen.getByText('05/01/2099')).toBeInTheDocument()
    expect(screen.getByText('Khalid Al Dosari')).toBeInTheDocument() // coach (admin only)
    expect(screen.getByText('Field 2')).toBeInTheDocument()
    expect(screen.getByText('Bring bibs')).toBeInTheDocument()
    expect(screen.getByText('Upcoming', { selector: 'span' })).toBeInTheDocument()
  })

  it("doesn't show the coach row to a coach", async () => {
    renderDetail('coach')
    await screen.findByText('Field 2')
    expect(screen.queryByText('Khalid Al Dosari')).not.toBeInTheDocument()
  })

  describe('who attended', () => {
    beforeEach(() => {
      // Attendance is taken from the session's day on, so these use a session that has started.
      vi.mocked(api.getSession).mockResolvedValue({ ...session, session_date: PAST })
    })

    it('says so while attendance has not been taken, and offers to take it', async () => {
      const router = renderDetail('coach')
      expect(
        await screen.findByText("Attendance hasn't been taken for this session yet."),
      ).toBeInTheDocument()
      await userEvent.click(screen.getByRole('link', { name: 'Take attendance' }))
      expect(router.state.location.pathname).toBe('/coach/sessions/s1/attendance')
    })

    it('lists who was present and absent, with a summary, and offers to edit', async () => {
      vi.mocked(attendanceApi.getSessionAttendance).mockResolvedValue([
        fakeMark('p1', 'Yousef Al Mahmood', 'present'),
        fakeMark('p2', 'Ali Hassan', 'absent'),
        fakeMark('p3', 'Hamad Salman', 'present'),
        fakeMark('p9', null, 'present'), // a player hidden from this coach now: no name, not shown
      ])
      renderDetail('coach')
      expect(await screen.findByText('2 of 3 present')).toBeInTheDocument()
      const items = screen.getAllByRole('listitem')
      expect(items.map((item) => item.textContent)).toEqual([
        'Ali HassanAbsent',
        'Hamad SalmanPresent',
        'Yousef Al MahmoodPresent',
      ])
      expect(screen.getByRole('link', { name: 'Edit attendance' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Take attendance' })).not.toBeInTheDocument()
    })

    it('offers a retry when the attendance cannot be loaded', async () => {
      vi.mocked(attendanceApi.getSessionAttendance).mockRejectedValue(new Error('boom'))
      renderDetail('coach')
      expect(await screen.findByText("Couldn't load the attendance.")).toBeInTheDocument()
      vi.mocked(attendanceApi.getSessionAttendance).mockResolvedValue([])
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(
        await screen.findByText("Attendance hasn't been taken for this session yet."),
      ).toBeInTheDocument()
    })
  })

  describe('a session dated in the future', () => {
    it("doesn't offer attendance yet, and says when it opens", async () => {
      renderDetail('coach')
      expect(
        await screen.findByText('Attendance opens on the day of the session.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Take attendance' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit attendance' })).not.toBeInTheDocument()
      // everything else is still available
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel session' })).toBeInTheDocument()
    })

    it('offers attendance once the day has come, with no waiting note', async () => {
      vi.mocked(api.getSession).mockResolvedValue({ ...session, session_date: PAST })
      renderDetail('coach')
      expect(await screen.findByRole('link', { name: 'Take attendance' })).toBeInTheDocument()
      expect(
        screen.queryByText('Attendance opens on the day of the session.'),
      ).not.toBeInTheDocument()
    })
  })

  describe('cancelling', () => {
    it('asks first, and keeping the session cancels nothing', async () => {
      renderDetail()
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel session' }))
      const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Keep session' }))
      expect(api.cancelSession).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('cancels after confirming', async () => {
      vi.mocked(api.cancelSession).mockResolvedValue(undefined)
      renderDetail()
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel session' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }))
      await waitFor(() => expect(api.cancelSession).toHaveBeenCalledWith('s1'))
      expect(await screen.findByText('Session cancelled')).toBeInTheDocument()
    })

    it('explains a refusal instead of showing database text', async () => {
      vi.mocked(api.cancelSession).mockRejectedValue(new Error('ajyal:session_cancelled'))
      renderDetail()
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel session' }))
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel session' }),
      )
      expect(
        await screen.findByText("This session was cancelled, so it can't be changed."),
      ).toBeInTheDocument()
    })

    it('shows a cancelled session as cancelled, with no way to change it or take attendance', async () => {
      vi.mocked(api.getSession).mockResolvedValue({
        ...session,
        cancelled_at: '2026-09-18T10:00:00Z',
      })
      renderDetail()
      expect(
        await screen.findByText("This session was cancelled. Attendance can't be taken."),
      ).toBeInTheDocument()
      expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument()
      for (const name of ['Take attendance', 'Edit attendance', 'Edit', 'Cancel session']) {
        expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
    })
  })

  it('edits the session in a form filled with its current values', async () => {
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit session' })
    expect(within(dialog).getByLabelText(/^Starts/)).toHaveValue('16:00')
  })

  describe('not found and errors', () => {
    it('shows "not found" for a missing session (or another coach\'s), with a way back', async () => {
      vi.mocked(api.getSession).mockResolvedValue(null)
      const router = renderDetail()
      expect(await screen.findByText('Session not found')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('link', { name: 'Back to sessions' }))
      expect(router.state.location.pathname).toBe('/admin/sessions')
    })

    it('offers a retry when loading fails', async () => {
      vi.mocked(api.getSession).mockRejectedValueOnce(new Error('boom'))
      renderDetail()
      expect(await screen.findByText("Couldn't load this session")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Field 2')).toBeInTheDocument()
    })
  })
})
