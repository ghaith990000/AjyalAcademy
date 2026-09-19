import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as sessionsApi from '@/features/sessions/api'
import * as subscriptionsApi from '@/features/subscriptions/api'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { FUTURE, fakeMark, fakeSession } from '@/test/sessions'
import * as api from './api'
import AttendancePage from './AttendancePage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listRoster: vi.fn(),
  getSessionAttendance: vi.fn(),
  saveAttendance: vi.fn(),
}))
vi.mock('@/features/sessions/api', async (importOriginal) => ({
  ...(await importOriginal<typeof sessionsApi>()),
  getSession: vi.fn(),
}))
vi.mock('@/features/subscriptions/api', async (importOriginal) => ({
  ...(await importOriginal<typeof subscriptionsApi>()),
  listPlayersCoveredOn: vi.fn(),
}))

// Deliberately not in alphabetical order: the screen sorts them.
const ROSTER = [
  { id: 'p3', full_name: 'Yousef Al Mahmood' },
  { id: 'p1', full_name: 'Ali Hassan' },
  { id: 'p2', full_name: 'Hamad Salman' },
]

function renderPage(role: 'admin' | 'coach' = 'coach') {
  const prefix = `/${role}/sessions`
  const router = createMemoryRouter(
    [
      { path: `${prefix}/:id`, element: <p>session detail page</p> },
      { path: `${prefix}/:id/attendance`, element: <AttendancePage /> },
    ],
    { initialEntries: [`${prefix}/s1/attendance`] },
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

const rows = () =>
  screen
    .getAllByRole('button', { pressed: undefined })
    .filter((b) => b.hasAttribute('aria-pressed'))
const row = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
const counts = () => {
  const status = screen.getByRole('status')
  return [...status.children].map((child) => child.textContent)
}

describe('AttendancePage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(sessionsApi.getSession).mockResolvedValue(
      fakeSession({ id: 's1', coach_id: 'coach-1' }),
    )
    vi.mocked(api.listRoster).mockResolvedValue(ROSTER)
    vi.mocked(api.getSessionAttendance).mockResolvedValue([])
    vi.mocked(api.saveAttendance).mockResolvedValue(undefined)
    vi.mocked(subscriptionsApi.listPlayersCoveredOn).mockResolvedValue(['p1', 'p2', 'p3'])
  })

  it("lists exactly the session coach's players, by name, everyone absent to start with", async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Attendance' })
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(api.listRoster).toHaveBeenCalledWith('coach-1')
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Ali Hassan'),
      expect.stringContaining('Hamad Salman'),
      expect.stringContaining('Yousef Al Mahmood'),
    ])
    expect(rows().every((r) => r.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(counts()).toEqual(['0Present', '3Absent', '3Players'])
  })

  it('toggles a player on tap and keeps the counts live', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Ali Hassan/ })
    await userEvent.click(row('Ali Hassan'))
    expect(row('Ali Hassan')).toHaveAttribute('aria-pressed', 'true')
    expect(counts()).toEqual(['1Present', '2Absent', '3Players'])

    await userEvent.click(row('Yousef'))
    expect(counts()).toEqual(['2Present', '1Absent', '3Players'])

    await userEvent.click(row('Ali Hassan')) // and back
    expect(row('Ali Hassan')).toHaveAttribute('aria-pressed', 'false')
    expect(counts()).toEqual(['1Present', '2Absent', '3Players'])
  })

  it('marks everyone present, and clears again', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Ali Hassan/ })
    await userEvent.click(screen.getByRole('button', { name: 'Mark all present' }))
    expect(counts()).toEqual(['3Present', '0Absent', '3Players'])
    expect(rows().every((r) => r.getAttribute('aria-pressed') === 'true')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(counts()).toEqual(['0Present', '3Absent', '3Players'])
  })

  it('makes each row at least 56px tall, so it is comfortable one-handed', async () => {
    renderPage()
    const button = await screen.findByRole('button', { name: /Ali Hassan/ })
    // jsdom has no layout, so check the class that sets the height (min-h-16 = 64px ≥ 56px).
    expect(button.className).toMatch(/\bmin-h-16\b/)
  })

  describe('saving', () => {
    it('sends every rostered player with their mark, then goes to the session', async () => {
      const router = renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await userEvent.click(row('Ali Hassan'))
      await userEvent.click(row('Yousef'))
      await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }))

      await waitFor(() => expect(api.saveAttendance).toHaveBeenCalledTimes(1))
      const [sessionId, records] = vi.mocked(api.saveAttendance).mock.calls[0]!
      expect(sessionId).toBe('s1')
      expect(records).toEqual([
        { player_id: 'p1', status: 'present' }, // Ali
        { player_id: 'p2', status: 'absent' }, // Hamad
        { player_id: 'p3', status: 'present' }, // Yousef
      ])
      expect(await screen.findByText('Attendance saved')).toBeInTheDocument()
      await waitFor(() => expect(router.state.location.pathname).toBe('/coach/sessions/s1'))
    })

    it('allows a first save with nobody present (everyone absent is a real result)', async () => {
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      const save = screen.getByRole('button', { name: 'Save attendance' })
      expect(save).toBeEnabled()
      await userEvent.click(save)
      await waitFor(() => expect(api.saveAttendance).toHaveBeenCalled())
      expect(
        vi.mocked(api.saveAttendance).mock.calls[0]![1].every((r) => r.status === 'absent'),
      ).toBe(true)
    })

    it('tells the coach when the database refuses (a roster that changed) and stays put', async () => {
      vi.mocked(api.saveAttendance).mockRejectedValue(new Error('ajyal:not_on_roster'))
      const router = renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }))
      expect(
        await screen.findByText(
          "One of the players isn't on this coach's roster any more. Reload and try again.",
        ),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/coach/sessions/s1/attendance')
    })
  })

  describe('editing saved attendance', () => {
    beforeEach(() => {
      vi.mocked(api.getSessionAttendance).mockResolvedValue([
        fakeMark('p1', 'Ali Hassan', 'present'),
        fakeMark('p2', 'Hamad Salman', 'absent'),
        // Left the roster since (reassigned): ignored, and never sent again.
        fakeMark('p9', 'Former Player', 'present'),
      ])
    })

    it('opens with the saved marks, and Save waits for a change', async () => {
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      expect(row('Ali Hassan')).toHaveAttribute('aria-pressed', 'true')
      expect(row('Hamad')).toHaveAttribute('aria-pressed', 'false')
      expect(row('Yousef')).toHaveAttribute('aria-pressed', 'false') // never marked → absent
      expect(counts()).toEqual(['1Present', '2Absent', '3Players'])
      expect(screen.queryByText('Former Player')).not.toBeInTheDocument()

      const save = screen.getByRole('button', { name: 'Save attendance' })
      expect(save).toBeDisabled()
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

      await userEvent.click(row('Hamad'))
      expect(save).toBeEnabled()
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

      await userEvent.click(row('Hamad')) // back to what is saved
      expect(save).toBeDisabled()
    })

    it('re-saves the corrected marks for the current roster only', async () => {
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await userEvent.click(row('Hamad'))
      await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }))
      await waitFor(() => expect(api.saveAttendance).toHaveBeenCalled())
      expect(vi.mocked(api.saveAttendance).mock.calls[0]![1]).toEqual([
        { player_id: 'p1', status: 'present' },
        { player_id: 'p2', status: 'present' },
        { player_id: 'p3', status: 'absent' },
      ])
    })
  })

  describe('subscription warning', () => {
    it('flags players without a subscription covering the session day, but still lets them be marked', async () => {
      vi.mocked(subscriptionsApi.listPlayersCoveredOn).mockResolvedValue(['p1', 'p3'])
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await waitFor(() =>
        expect(within(row('Hamad')).getByText('No active subscription')).toBeVisible(),
      )
      expect(
        within(row('Ali Hassan')).queryByText('No active subscription'),
      ).not.toBeInTheDocument()
      expect(screen.getAllByText('No active subscription')).toHaveLength(1)
      await userEvent.click(row('Hamad'))
      expect(row('Hamad')).toHaveAttribute('aria-pressed', 'true')
      expect(subscriptionsApi.listPlayersCoveredOn).toHaveBeenCalledWith(
        ['p1', 'p2', 'p3'],
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      )
    })

    it('shows no warnings at all if the subscription lookup fails', async () => {
      vi.mocked(subscriptionsApi.listPlayersCoveredOn).mockRejectedValue(new Error('offline'))
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await waitFor(() => expect(subscriptionsApi.listPlayersCoveredOn).toHaveBeenCalled())
      expect(screen.queryByText('No active subscription')).not.toBeInTheDocument()
      expect(rows()).toHaveLength(3)
    })
  })

  describe('other states', () => {
    it('will not take attendance for a cancelled session', async () => {
      vi.mocked(sessionsApi.getSession).mockResolvedValue(
        fakeSession({ id: 's1', cancelled_at: '2026-09-18T10:00:00Z' }),
      )
      renderPage()
      expect(await screen.findByText('This session was cancelled')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Ali Hassan/ })).not.toBeInTheDocument()
    })

    it('will not take attendance for a session dated in the future', async () => {
      vi.mocked(sessionsApi.getSession).mockResolvedValue(
        fakeSession({ id: 's1', session_date: FUTURE }),
      )
      renderPage()
      expect(await screen.findByText("Attendance isn't open yet")).toBeInTheDocument()
      expect(
        screen.getByText('Attendance can be taken from the day of the session.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Ali Hassan/ })).not.toBeInTheDocument()
    })

    it("explains the database's refusal if the academy's date has moved on differently from this device's", async () => {
      vi.mocked(api.saveAttendance).mockRejectedValue(new Error('ajyal:session_in_future'))
      renderPage()
      await screen.findByRole('button', { name: /Ali Hassan/ })
      await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }))
      expect(
        await screen.findByText('Attendance can only be taken from the day of the session.'),
      ).toBeInTheDocument()
    })

    it('explains an empty roster', async () => {
      vi.mocked(api.listRoster).mockResolvedValue([])
      renderPage()
      expect(await screen.findByText('No players on this roster')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
    })

    it("says so for a missing session (or another coach's)", async () => {
      vi.mocked(sessionsApi.getSession).mockResolvedValue(null)
      renderPage()
      expect(await screen.findByText('Session not found')).toBeInTheDocument()
      expect(api.listRoster).not.toHaveBeenCalled()
    })

    it('offers a retry when loading fails', async () => {
      vi.mocked(api.listRoster).mockRejectedValueOnce(new Error('boom'))
      renderPage()
      expect(await screen.findByText("Couldn't load the attendance screen")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('button', { name: /Ali Hassan/ })).toBeInTheDocument()
    })

    it('shows the session context, with the coach for an admin only', async () => {
      renderPage('admin')
      expect(await screen.findByText(/Khalid Al Dosari/)).toBeInTheDocument()
    })

    it('reads in Arabic, with Arabic state labels', async () => {
      await i18n.changeLanguage('ar')
      renderPage()
      expect(await screen.findByRole('heading', { name: 'الحضور' })).toBeInTheDocument()
      await userEvent.click(await screen.findByRole('button', { name: /Ali Hassan/ }))
      expect(within(row('Ali Hassan')).getByText('حاضر')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'حفظ الحضور' })).toBeEnabled()
    })
  })
})
