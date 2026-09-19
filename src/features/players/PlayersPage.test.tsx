import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import * as subscriptionsApi from '@/features/subscriptions/api'
import { ageInYears } from '@/lib/dates'
import i18n from '@/lib/i18n'
import { fakeAuth, fakeProfile } from '@/test/auth'
import { fakePlayer } from '@/test/players'
import * as api from './api'
import PlayersPage from './PlayersPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listPlayers: vi.fn(),
  assignPlayers: vi.fn(),
  createPlayer: vi.fn(),
}))
vi.mock('@/features/subscriptions/api', async (importOriginal) => ({
  ...(await importOriginal<typeof subscriptionsApi>()),
  listPlayerStatuses: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const coachKhalid = fakeProfile('coach', { id: 'c1', full_name: 'Khalid Al Dosari' })
const coachSara = fakeProfile('coach', { id: 'c2', full_name: 'Sara Al Khalifa' })

const yousef = fakePlayer({ id: 'y', full_name: 'Yousef Al Mahmood', cpr: '150312345' })
const ali = fakePlayer({
  id: 'a',
  full_name: 'Ali Hassan',
  cpr: '140708821',
  has_disease: true,
  disease_description: 'Asthma',
  school: null,
  coach_id: null,
  coach: null,
})

function renderPage(role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/players`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <PlayersPage /> },
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

const lastFilters = () => vi.mocked(api.listPlayers).mock.lastCall![0]
const rowsOf = (name: string) => screen.getAllByText(name)

describe('PlayersPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listPlayers).mockResolvedValue({ rows: [yousef, ali], total: 2 })
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([coachKhalid, coachSara])
    vi.mocked(subscriptionsApi.listPlayerStatuses).mockResolvedValue({
      y: 'active',
      a: 'expiring_soon',
    })
  })

  describe('as an admin', () => {
    it('lists players with age, coach and a medical-condition badge', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Players' })).toBeInTheDocument()
      await screen.findAllByText('Yousef Al Mahmood')
      expect(rowsOf('Ali Hassan').length).toBeGreaterThan(0)
      expect(screen.getAllByText(`${ageInYears('2015-03-12')} yrs`).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Khalid Al Dosari').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Condition').length).toBeGreaterThan(0)
      expect(screen.getByText('Showing 2 of 2')).toBeInTheDocument()
    })

    it('shows each player\'s real subscription status, or "None"', async () => {
      vi.mocked(subscriptionsApi.listPlayerStatuses).mockResolvedValue({ y: 'active' })
      renderPage()
      await screen.findAllByText('Yousef Al Mahmood')
      expect((await screen.findAllByText('Active')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('None').length).toBeGreaterThan(0) // Ali has no subscription
      expect(subscriptionsApi.listPlayerStatuses).toHaveBeenCalledWith(['a', 'y'])
    })

    it('searches after a pause in typing, not on every keystroke', async () => {
      renderPage()
      await screen.findAllByText('Yousef Al Mahmood')
      const callsBefore = vi.mocked(api.listPlayers).mock.calls.length
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'ali')
      await waitFor(() => expect(lastFilters().search).toBe('ali'))
      // three keystrokes produced one extra query, not three
      expect(vi.mocked(api.listPlayers).mock.calls.length).toBe(callsBefore + 1)
    })

    it('filters by coach, unassigned and medical condition', async () => {
      renderPage()
      await screen.findAllByText('Yousef Al Mahmood')

      await userEvent.selectOptions(screen.getByLabelText('Coach'), 'c2')
      await waitFor(() => expect(lastFilters().coach).toBe('c2'))

      await userEvent.selectOptions(screen.getByLabelText('Coach'), 'unassigned')
      await waitFor(() => expect(lastFilters().coach).toBe('unassigned'))

      await userEvent.click(screen.getByRole('checkbox', { name: 'Has a medical condition' }))
      await waitFor(() => expect(lastFilters().hasCondition).toBe(true))
    })

    it('sorts by newest', async () => {
      renderPage()
      await screen.findAllByText('Yousef Al Mahmood')
      await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'newest')
      await waitFor(() => expect(lastFilters().sort).toBe('newest'))
    })

    it('shows a "no match" state with a way back when filters find nothing', async () => {
      renderPage()
      await screen.findAllByText('Yousef Al Mahmood')
      vi.mocked(api.listPlayers).mockResolvedValue({ rows: [], total: 0 })
      const search = screen.getByRole('searchbox', { name: 'Search' })
      await userEvent.type(search, 'zzz')
      expect(await screen.findByText('No players match')).toBeInTheDocument()

      // The unfiltered list is still in the query cache, so it comes straight back.
      await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
      expect(search).toHaveValue('')
      expect((await screen.findAllByText('Yousef Al Mahmood')).length).toBeGreaterThan(0)
      expect(screen.queryByText('No players match')).not.toBeInTheDocument()
    })

    it('shows an empty state with an add button when there are no players at all', async () => {
      vi.mocked(api.listPlayers).mockResolvedValue({ rows: [], total: 0 })
      renderPage()
      expect(await screen.findByText('No players yet')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Add player' }).length).toBeGreaterThan(1)
    })

    it('shows a retry state when loading fails', async () => {
      vi.mocked(api.listPlayers).mockRejectedValue(new Error('boom'))
      renderPage()
      expect(await screen.findByText("Couldn't load players")).toBeInTheDocument()
      vi.mocked(api.listPlayers).mockResolvedValue({ rows: [yousef], total: 1 })
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect((await screen.findAllByText('Yousef Al Mahmood')).length).toBeGreaterThan(0)
    })

    it('loads the next page on "Show more"', async () => {
      const firstPage = Array.from({ length: 20 }, () => fakePlayer())
      vi.mocked(api.listPlayers).mockImplementation(async (_filters, page) =>
        page === 0
          ? { rows: firstPage, total: 21 }
          : { rows: [fakePlayer({ full_name: 'Twenty First' })], total: 21 },
      )
      renderPage()
      expect(await screen.findByText('Showing 20 of 21')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      expect(await screen.findByText('Showing 21 of 21')).toBeInTheDocument()
      expect(vi.mocked(api.listPlayers).mock.lastCall![1]).toBe(1)
      expect(screen.getAllByText('Twenty First').length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })

    it('opens the player when a row is clicked', async () => {
      const router = renderPage()
      await userEvent.click((await screen.findAllByText('Yousef Al Mahmood'))[0]!)
      expect(router.state.location.pathname).toBe('/admin/players/y')
    })

    describe('bulk assignment', () => {
      async function selectBoth() {
        renderPage()
        await screen.findAllByText('Yousef Al Mahmood')
        await userEvent.click(
          screen.getAllByRole('checkbox', { name: 'Select Yousef Al Mahmood' })[0]!,
        )
        await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select Ali Hassan' })[0]!)
      }

      it('shows how many are selected and does not navigate when ticking a box', async () => {
        const router = renderPage()
        await screen.findAllByText('Yousef Al Mahmood')
        await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select Ali Hassan' })[0]!)
        expect(await screen.findByText('1 selected')).toBeInTheDocument()
        expect(router.state.location.pathname).toBe('/admin/players')
      })

      it('selects every shown player at once', async () => {
        renderPage()
        await screen.findAllByText('Yousef Al Mahmood')
        await userEvent.click(
          screen.getAllByRole('checkbox', { name: 'Select all shown players' })[0]!,
        )
        expect(await screen.findByText('2 selected')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
        expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
      })

      it('assigns the selected players to a coach in one call, then clears the selection', async () => {
        vi.mocked(api.assignPlayers).mockResolvedValue(2)
        await selectBoth()
        expect(await screen.findByText('2 selected')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Assign to coach' }))

        const dialog = await screen.findByRole('dialog', { name: 'Assign to coach' })
        expect(within(dialog).getByRole('button', { name: 'Assign' })).toBeDisabled()
        await userEvent.selectOptions(within(dialog).getByLabelText(/Coach/), 'c2')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))

        await waitFor(() => expect(api.assignPlayers).toHaveBeenCalledWith(['y', 'a'], 'c2'))
        expect(await screen.findByText('Coach updated')).toBeInTheDocument()
        expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
      })

      it('can unassign players (no coach)', async () => {
        vi.mocked(api.assignPlayers).mockResolvedValue(2)
        await selectBoth()
        await userEvent.click(await screen.findByRole('button', { name: 'Assign to coach' }))
        const dialog = await screen.findByRole('dialog')
        await userEvent.selectOptions(within(dialog).getByLabelText(/Coach/), 'Unassign (no coach)')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
        await waitFor(() => expect(api.assignPlayers).toHaveBeenCalledWith(['y', 'a'], null))
      })

      it('says so when nothing needed to change', async () => {
        vi.mocked(api.assignPlayers).mockResolvedValue(0)
        await selectBoth()
        await userEvent.click(await screen.findByRole('button', { name: 'Assign to coach' }))
        const dialog = await screen.findByRole('dialog')
        await userEvent.selectOptions(within(dialog).getByLabelText(/Coach/), 'c1')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
        expect(await screen.findByText('No changes')).toBeInTheDocument()
      })

      it('drops the selection when the filters change', async () => {
        await selectBoth()
        expect(await screen.findByText('2 selected')).toBeInTheDocument()
        await userEvent.selectOptions(screen.getByLabelText('Coach'), 'c2')
        await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument())
      })
    })
  })

  describe('as a coach', () => {
    it('shows "My players" without the coach filter, coach column or selection boxes', async () => {
      renderPage('coach')
      expect(await screen.findByRole('heading', { name: 'My players' })).toBeInTheDocument()
      await screen.findAllByText('Yousef Al Mahmood')
      expect(screen.queryByLabelText('Coach')).not.toBeInTheDocument()
      expect(screen.queryByRole('columnheader', { name: 'Coach' })).not.toBeInTheDocument()
      expect(screen.queryAllByRole('checkbox', { name: /Select/ })).toHaveLength(0)
      // A coach never asks the server for the coach list.
      expect(coachesApi.listCoaches).not.toHaveBeenCalled()
    })

    it('opens players under their own /coach area', async () => {
      const router = renderPage('coach')
      await userEvent.click((await screen.findAllByText('Yousef Al Mahmood'))[0]!)
      expect(router.state.location.pathname).toBe('/coach/players/y')
    })

    it('has a coach-specific empty state', async () => {
      vi.mocked(api.listPlayers).mockResolvedValue({ rows: [], total: 0 })
      renderPage('coach')
      expect(await screen.findByText('No players assigned to you yet')).toBeInTheDocument()
    })
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'اللاعبون' })).toBeInTheDocument()
    await screen.findAllByText('Yousef Al Mahmood')
    expect(screen.getAllByText(`${ageInYears('2015-03-12')} سنة`).length).toBeGreaterThan(0)
    expect(screen.getByText('عرض 2 من 2')).toBeInTheDocument()
  })
})
