import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as attendanceApi from '@/features/attendance/api'
import * as coachesApi from '@/features/coaches/api'
import * as subscriptionsApi from '@/features/subscriptions/api'
import i18n from '@/lib/i18n'
import { fakeAuth, fakeProfile } from '@/test/auth'
import { fakePlayer } from '@/test/players'
import * as api from './api'
import PlayerDetailPage from './PlayerDetailPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getPlayer: vi.fn(),
  removePlayer: vi.fn(),
  assignPlayers: vi.fn(),
  updatePlayer: vi.fn(),
}))
vi.mock('@/features/subscriptions/api', async (importOriginal) => ({
  ...(await importOriginal<typeof subscriptionsApi>()),
  listPlayerSubscriptions: vi.fn(),
}))
vi.mock('@/features/attendance/api', async (importOriginal) => ({
  ...(await importOriginal<typeof attendanceApi>()),
  listPlayerAttendance: vi.fn(),
  countPlayerPresent: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const healthy = fakePlayer({ id: 'p1', full_name: 'Yousef Al Mahmood', cpr: '150312345' })
const withCondition = fakePlayer({
  id: 'p2',
  full_name: 'Ali Hassan',
  cpr: '140708821',
  date_of_birth: '2014-08-07',
  has_disease: true,
  disease_description: 'Asthma — carries an inhaler',
  school: null,
  address: null,
  coach_id: null,
  coach: null,
})

function renderDetail(id: string, role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/players`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <p>list page</p> },
      { path: `${prefix}/:id`, element: <PlayerDetailPage /> },
    ],
    { initialEntries: [`${prefix}/${id}`] },
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

describe('PlayerDetailPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.getPlayer).mockImplementation(async (id) =>
      id === 'p1' ? healthy : id === 'p2' ? withCondition : null,
    )
    vi.mocked(subscriptionsApi.listPlayerSubscriptions).mockResolvedValue([])
    vi.mocked(attendanceApi.listPlayerAttendance).mockResolvedValue({ rows: [], total: 0 })
    vi.mocked(attendanceApi.countPlayerPresent).mockResolvedValue(0)
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([
      fakeProfile('coach', { id: 'c1', full_name: 'Khalid Al Dosari' }),
      fakeProfile('coach', { id: 'c2', full_name: 'Sara Al Khalifa' }),
    ])
  })

  it('shows the player, formatted date, age and a tappable phone number', async () => {
    renderDetail('p1')
    expect(await screen.findByRole('heading', { name: 'Yousef Al Mahmood' })).toBeInTheDocument()
    expect(screen.getByText('150312345')).toBeInTheDocument()
    expect(screen.getByText('12/03/2015')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '39111001' })).toHaveAttribute('href', 'tel:39111001')
    expect(screen.getByText('Al Rifa Primary School')).toBeInTheDocument()
    expect(screen.getByText('Riffa, Block 901')).toBeInTheDocument()
  })

  it('highlights a medical condition with its description', async () => {
    renderDetail('p2')
    expect(await screen.findByText('Asthma — carries an inhaler')).toBeInTheDocument()
    expect(screen.getAllByText('Medical condition').length).toBeGreaterThan(0)
    expect(screen.queryByText('No known medical conditions.')).not.toBeInTheDocument()
  })

  it('says so when there is no medical condition', async () => {
    renderDetail('p1')
    expect(await screen.findByText('No known medical conditions.')).toBeInTheDocument()
  })

  it('marks missing school and address as not provided', async () => {
    renderDetail('p2')
    await screen.findByRole('heading', { name: 'Ali Hassan' })
    expect(screen.getAllByText('Not provided')).toHaveLength(2)
  })

  it("lists the player's subscriptions with status, and offers a new one for this player", async () => {
    vi.mocked(subscriptionsApi.listPlayerSubscriptions).mockResolvedValue([
      {
        id: 's1',
        plan_id: 'p',
        plan_code: 'solo',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        plan_price_fils: 20000,
        tshirt_total_fils: 5000,
        transport_total_fils: 0,
        discount_id: null,
        discount_type: null,
        discount_value: null,
        discount_reason: null,
        discount_fils: 0,
        total_fils: 25000,
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-10-01T00:00:00Z',
        paid_fils: 25000,
        balance_fils: 0,
        location_id: null,
        location_name: null,
        status: 'active',
        player_names: 'Yousef',
        player_count: 1,
      },
    ])
    renderDetail('p1')
    const row = await screen.findByRole('link', { name: /Solo · 25\.000 BD/ })
    expect(row).toHaveAttribute('href', '/admin/subscriptions/s1')
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New subscription' })).toHaveAttribute(
      'href',
      '/admin/subscriptions/new?player=p1',
    )
  })

  it('says so when the player has no subscriptions yet', async () => {
    renderDetail('p1')
    expect(await screen.findByText('No subscriptions yet.')).toBeInTheDocument()
  })

  it("shows the player's attendance rate and history, and says so when there is none", async () => {
    renderDetail('p1')
    expect(await screen.findByText('No attendance recorded yet.')).toBeInTheDocument()

    vi.mocked(attendanceApi.listPlayerAttendance).mockResolvedValue({
      rows: [
        {
          session_id: 's1',
          status: 'present',
          marked_at: '2026-09-19T15:00:00Z',
          session_date: '2026-09-19',
          start_time: '16:00:00',
          end_time: '17:30:00',
          location_id: null,
          location_name: null,
        },
        {
          session_id: 's2',
          status: 'absent',
          marked_at: '2026-09-16T15:00:00Z',
          session_date: '2026-09-16',
          start_time: '16:00:00',
          end_time: '17:30:00',
          location_id: null,
          location_name: null,
        },
      ],
      total: 2,
    })
    vi.mocked(attendanceApi.countPlayerPresent).mockResolvedValue(1)
    cleanup()
    renderDetail('p1')
    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Present at 1 of 2 sessions')).toBeInTheDocument()
    expect(screen.getByText('19/09/2026')).toBeInTheDocument()
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.getByText('Absent')).toBeInTheDocument()
  })

  describe('not found and errors', () => {
    it('shows "not found" for a missing, removed or foreign player, with a way back', async () => {
      const router = renderDetail('nope')
      expect(await screen.findByText('Player not found')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('link', { name: 'Back to players' }))
      expect(router.state.location.pathname).toBe('/admin/players')
    })

    it('offers a retry when loading fails', async () => {
      vi.mocked(api.getPlayer).mockRejectedValueOnce(new Error('boom'))
      renderDetail('p1')
      expect(await screen.findByText("Couldn't load this player")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('heading', { name: 'Yousef Al Mahmood' })).toBeInTheDocument()
    })
  })

  describe('removing', () => {
    it('asks for confirmation naming the player, then removes and returns to the list', async () => {
      vi.mocked(api.removePlayer).mockResolvedValue(undefined)
      const router = renderDetail('p1')
      await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))

      const dialog = await screen.findByRole('dialog', { name: 'Remove Yousef Al Mahmood?' })
      expect(within(dialog).getByText(/history is kept/)).toBeInTheDocument()
      expect(api.removePlayer).not.toHaveBeenCalled()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove player' }))
      await waitFor(() => expect(api.removePlayer).toHaveBeenCalledWith('p1'))
      expect(await screen.findByText('Player removed')).toBeInTheDocument()
      await waitFor(() => expect(router.state.location.pathname).toBe('/admin/players'))
    })

    it('does nothing when cancelled', async () => {
      renderDetail('p1')
      await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(api.removePlayer).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('stays on the page and shows an error if removal fails', async () => {
      vi.mocked(api.removePlayer).mockRejectedValue({ code: '42501', message: 'nope' })
      const router = renderDetail('p1')
      await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove player' }),
      )
      expect(await screen.findByText("You don't have permission to do that.")).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/players/p1')
    })
  })

  describe('editing', () => {
    it('opens the form with the current values', async () => {
      renderDetail('p1')
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
      const dialog = await screen.findByRole('dialog', { name: 'Edit player' })
      expect(within(dialog).getByLabelText(/Full name/)).toHaveValue('Yousef Al Mahmood')
    })
  })

  describe('coach assignment', () => {
    it('lets an admin see and change the coach', async () => {
      vi.mocked(api.assignPlayers).mockResolvedValue(1)
      renderDetail('p1', 'admin')
      const select = await screen.findByLabelText('Coach', { selector: 'select' })
      await screen.findByRole('option', { name: 'Sara Al Khalifa' })
      expect(select).toHaveValue('c1')
      const save = screen.getByRole('button', { name: 'Save' })
      expect(save).toBeDisabled() // nothing changed yet

      await userEvent.selectOptions(select, 'c2')
      await userEvent.click(save)
      await waitFor(() => expect(api.assignPlayers).toHaveBeenCalledWith(['p1'], 'c2'))
      expect(await screen.findByText('Coach updated')).toBeInTheDocument()
    })

    it('lets an admin unassign', async () => {
      vi.mocked(api.assignPlayers).mockResolvedValue(1)
      renderDetail('p1', 'admin')
      const select = await screen.findByLabelText('Coach', { selector: 'select' })
      await screen.findByRole('option', { name: 'Sara Al Khalifa' })
      await userEvent.selectOptions(select, '')
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(api.assignPlayers).toHaveBeenCalledWith(['p1'], null))
    })

    it('shows an unassigned player as unassigned', async () => {
      renderDetail('p2', 'admin')
      const select = await screen.findByLabelText('Coach', { selector: 'select' })
      expect(select).toHaveValue('')
    })

    it('is not offered to a coach, who also never asks for the coach list', async () => {
      renderDetail('p1', 'coach')
      await screen.findByRole('heading', { name: 'Yousef Al Mahmood' })
      expect(screen.queryByText('Coach assignment')).not.toBeInTheDocument()
      expect(screen.queryByText('Khalid Al Dosari')).not.toBeInTheDocument()
      expect(coachesApi.listCoaches).not.toHaveBeenCalled()
    })

    it('keeps links inside the coach area for a coach', async () => {
      renderDetail('p1', 'coach')
      await screen.findByRole('heading', { name: 'Yousef Al Mahmood' })
      expect(screen.getByRole('link', { name: 'Back to players' })).toHaveAttribute(
        'href',
        '/coach/players',
      )
    })
  })

  it('renders in Arabic with the back arrow flipped for RTL', async () => {
    await i18n.changeLanguage('ar')
    renderDetail('p2')
    expect(await screen.findByRole('heading', { name: 'Ali Hassan' })).toBeInTheDocument()
    expect(screen.getAllByText('حالة صحية').length).toBeGreaterThan(0)
    const back = screen.getByRole('link', { name: 'العودة إلى اللاعبين' })
    expect(back.querySelector('svg')).toHaveClass('rtl:-scale-x-100')
  })
})
