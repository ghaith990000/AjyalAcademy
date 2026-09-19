import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import i18n from '@/lib/i18n'
import { fakeAuth, fakeProfile } from '@/test/auth'
import { FUTURE, fakeSession } from '@/test/sessions'
import * as api from './api'
import { SessionFormDialog } from './SessionFormDialog'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  createSessions: vi.fn(),
  updateSession: vi.fn(),
  listCoachSessionsBetween: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const onClose = vi.fn()

async function renderForm(role: 'admin' | 'coach' = 'coach', session?: api.SessionRow) {
  render(
    <Providers>
      <AuthContext.Provider value={fakeAuth(role)}>
        <SessionFormDialog session={session} onClose={onClose} />
      </AuthContext.Provider>
    </Providers>,
  )
  return screen.findByRole('dialog')
}

/** Date, start and end (the fields every session needs). */
function fillTimes(dialog: HTMLElement, date = FUTURE, start = '16:00', end = '17:30') {
  fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: date } })
  fireEvent.change(within(dialog).getByLabelText(/^Starts/), { target: { value: start } })
  fireEvent.change(within(dialog).getByLabelText(/^Ends/), { target: { value: end } })
}

const submit = (dialog: HTMLElement, name = 'Schedule') =>
  userEvent.click(within(dialog).getByRole('button', { name }))

describe('SessionFormDialog', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listCoachSessionsBetween).mockResolvedValue([])
    vi.mocked(api.createSessions).mockResolvedValue(['new'])
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([
      fakeProfile('coach', { id: 'c1', full_name: 'Khalid Al Dosari' }),
      fakeProfile('coach', { id: 'c2', full_name: 'Sara Al Khalifa' }),
      fakeProfile('coach', { id: 'c3', full_name: 'Retired Coach', active: false }),
    ])
  })

  describe('validation', () => {
    it('asks for the times (and the coach, for an admin) and does not call the server', async () => {
      const dialog = await renderForm('admin')
      await submit(dialog)
      expect(await within(dialog).findByText('Choose a start time.')).toBeInTheDocument()
      expect(within(dialog).getByText('Choose an end time.')).toBeInTheDocument()
      expect(within(dialog).getByText('Choose a coach.')).toBeInTheDocument()
      expect(api.createSessions).not.toHaveBeenCalled()
    })

    it('needs the end to be after the start', async () => {
      const dialog = await renderForm()
      fillTimes(dialog, FUTURE, '17:00', '16:00')
      await submit(dialog)
      expect(
        await within(dialog).findByText('The end must be after the start.'),
      ).toBeInTheDocument()
      expect(api.createSessions).not.toHaveBeenCalled()
    })

    it('needs a whole number of weeks from 2 to 26 when repeating', async () => {
      const dialog = await renderForm()
      fillTimes(dialog)
      await userEvent.click(within(dialog).getByRole('switch', { name: /Repeat every week/ }))
      const weeks = within(dialog).getByLabelText(/^Number of weeks/)
      await userEvent.clear(weeks)
      await userEvent.type(weeks, '1')
      await submit(dialog)
      expect(
        await within(dialog).findByText('Enter a whole number from 2 to 26.'),
      ).toBeInTheDocument()
      expect(api.createSessions).not.toHaveBeenCalled()
    })
  })

  describe('as a coach', () => {
    it('has no coach field and schedules for themself', async () => {
      const dialog = await renderForm('coach')
      expect(within(dialog).queryByLabelText(/^Coach/)).not.toBeInTheDocument()
      fillTimes(dialog)
      await userEvent.type(within(dialog).getByLabelText('Location'), '  Field 2 ')
      await submit(dialog)
      await waitFor(() =>
        expect(api.createSessions).toHaveBeenCalledWith([
          {
            session_date: FUTURE,
            start_time: '16:00',
            end_time: '17:30',
            coach_id: 'coach-1', // the signed-in fake coach
            location: 'Field 2',
            notes: null,
          },
        ]),
      )
      expect(await screen.findByText('Session scheduled')).toBeInTheDocument()
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('as an admin', () => {
    it('picks an active coach and schedules for them', async () => {
      const dialog = await renderForm('admin')
      const coach = within(dialog).getByLabelText(/^Coach/)
      await waitFor(() => expect(within(coach).getAllByRole('option')).toHaveLength(3))
      expect(
        within(coach)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Choose a coach', 'Khalid Al Dosari', 'Sara Al Khalifa']) // not the deactivated one
      await userEvent.selectOptions(coach, 'c2')
      fillTimes(dialog)
      await submit(dialog)
      await waitFor(() => expect(api.createSessions).toHaveBeenCalledTimes(1))
      expect(vi.mocked(api.createSessions).mock.calls[0]![0]).toEqual([
        expect.objectContaining({ coach_id: 'c2', session_date: FUTURE }),
      ])
    })
  })

  describe('repeat weekly', () => {
    it('creates one session a week, N in total including the first, in one call', async () => {
      const dialog = await renderForm('coach')
      fillTimes(dialog, '2026-12-25')
      expect(within(dialog).queryByLabelText(/^Number of weeks/)).not.toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole('switch', { name: /Repeat every week/ }))
      const weeks = within(dialog).getByLabelText(/^Number of weeks/)
      await userEvent.clear(weeks)
      await userEvent.type(weeks, '3')
      await submit(dialog)
      await waitFor(() => expect(api.createSessions).toHaveBeenCalledTimes(1))
      const rows = vi.mocked(api.createSessions).mock.calls[0]![0]
      expect(rows.map((row) => row.session_date)).toEqual([
        '2026-12-25',
        '2027-01-01',
        '2027-01-08',
      ])
      expect(rows.every((row) => row.start_time === '16:00' && row.end_time === '17:30')).toBe(true)
      expect(await screen.findByText('3 sessions scheduled')).toBeInTheDocument()
    })
  })

  describe('overlap warning', () => {
    it('warns, without blocking, when the coach already has a session at that time', async () => {
      vi.mocked(api.listCoachSessionsBetween).mockResolvedValue([
        { id: 'x', session_date: FUTURE, start_time: '17:00:00', end_time: '18:00:00' },
      ])
      const dialog = await renderForm('coach')
      expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
      fillTimes(dialog, FUTURE, '16:00', '17:30')
      const warning = await within(dialog).findByRole('status')
      expect(warning).toHaveTextContent('This coach already has a session at that time')
      expect(warning).toHaveTextContent('05/01/2099 · 5:00 PM – 6:00 PM')
      expect(api.listCoachSessionsBetween).toHaveBeenCalledWith('coach-1', FUTURE, FUTURE)

      await submit(dialog) // still allowed
      await waitFor(() => expect(api.createSessions).toHaveBeenCalledTimes(1))
    })

    it('stays quiet when the sessions only touch, and ignores the session being edited', async () => {
      vi.mocked(api.listCoachSessionsBetween).mockResolvedValue([
        { id: 'x', session_date: FUTURE, start_time: '17:30:00', end_time: '18:30:00' },
        { id: 'me', session_date: FUTURE, start_time: '16:00:00', end_time: '17:30:00' },
      ])
      const dialog = await renderForm(
        'coach',
        fakeSession({ id: 'me', session_date: FUTURE, coach_id: 'coach-1' }),
      )
      await waitFor(() => expect(api.listCoachSessionsBetween).toHaveBeenCalled())
      expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('editing', () => {
    const existing = fakeSession({
      id: 'e1',
      session_date: FUTURE,
      start_time: '16:00:00',
      end_time: '17:30:00',
      coach_id: 'c1',
      location: 'Field 2',
      notes: 'Bring bibs',
    })

    it('shows the current values, has no repeat option, and saves the changes', async () => {
      const dialog = await renderForm('admin', existing)
      expect(within(dialog).getByRole('heading', { name: 'Edit session' })).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/^Starts/)).toHaveValue('16:00')
      expect(within(dialog).getByLabelText(/^Ends/)).toHaveValue('17:30')
      expect(within(dialog).getByLabelText('Location')).toHaveValue('Field 2')
      expect(within(dialog).getByLabelText('Notes')).toHaveValue('Bring bibs')
      expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument()

      fireEvent.change(within(dialog).getByLabelText(/^Ends/), { target: { value: '18:00' } })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
      await waitFor(() =>
        expect(api.updateSession).toHaveBeenCalledWith('e1', {
          session_date: FUTURE,
          start_time: '16:00',
          end_time: '18:00',
          coach_id: 'c1',
          location: 'Field 2',
          notes: 'Bring bibs',
        }),
      )
      expect(api.createSessions).not.toHaveBeenCalled()
      expect(await screen.findByText('Session updated')).toBeInTheDocument()
    })

    it('explains a refused coach change instead of showing database text', async () => {
      vi.mocked(api.updateSession).mockRejectedValue(new Error('ajyal:session_has_attendance'))
      const dialog = await renderForm('admin', existing)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
      expect(
        await screen.findByText(
          "Attendance was already taken for this session, so its coach can't be changed.",
        ),
      ).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('shows a generic message for an unexpected failure and keeps the form open', async () => {
    vi.mocked(api.createSessions).mockRejectedValue(new Error('boom'))
    const dialog = await renderForm('coach')
    fillTimes(dialog)
    await submit(dialog)
    expect(
      await screen.findByText('An unexpected error occurred. Please try again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
