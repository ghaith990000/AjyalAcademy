import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as playersApi from '@/features/players/api'
import * as settingsApi from '@/features/settings/api'
import { defaultEndDate, todayISO } from '@/lib/dates'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { fakePlayer } from '@/test/players'
import { PLANS, SETTINGS } from '@/test/subscriptions'
import * as api from './api'
import NewSubscriptionPage from './NewSubscriptionPage'

vi.mock('@/features/players/api', async (importOriginal) => ({
  ...(await importOriginal<typeof playersApi>()),
  listPlayers: vi.fn(),
  getPlayer: vi.fn(),
}))
vi.mock('@/features/settings/api', async (importOriginal) => ({
  ...(await importOriginal<typeof settingsApi>()),
  listPlans: vi.fn(),
  getSettings: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listReturningPlayers: vi.fn(),
  listApplicableDiscounts: vi.fn(),
  createSubscription: vi.fn(),
}))

const yousef = fakePlayer({ id: 'p1', full_name: 'Yousef Al Mahmood', cpr: '150312345' })
const ali = fakePlayer({ id: 'p2', full_name: 'Ali Hassan', cpr: '140708821' })
const hamad = fakePlayer({ id: 'p3', full_name: 'Hamad Salman', cpr: '170430912' })
const sara = fakePlayer({ id: 'p4', full_name: 'Sara Khalid', cpr: '160309785' })
const omar = fakePlayer({ id: 'p5', full_name: 'Omar Faisal', cpr: '120518349' })
const everyone = [yousef, ali, hamad, sara, omar]

const tenPercent = {
  id: 'd1',
  name: 'Sibling discount',
  code: 'SIB10',
  type: 'percent' as const,
  value: 1000,
  valid_from: null,
  valid_to: null,
  max_uses: null,
  active: true,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
}

function renderWizard(role: 'admin' | 'coach' = 'coach', search = '') {
  const prefix = `/${role}/subscriptions`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <p>list page</p> },
      { path: `${prefix}/new`, element: <NewSubscriptionPage /> },
      { path: `${prefix}/:id`, element: <p>detail page</p> },
    ],
    { initialEntries: [`${prefix}/new${search}`] },
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

// `type=date` inputs do not take user-event typing reliably in jsdom.
function fireEventChange(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }))
const pick = (name: string) => userEvent.click(screen.getByRole('checkbox', { name }))

/** Choose players on step 1 and continue to "Period". */
async function choose(...names: string[]) {
  await screen.findByRole('checkbox', { name: names[0]! })
  for (const name of names) await pick(name)
  await next()
}

describe('NewSubscriptionPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(playersApi.listPlayers).mockResolvedValue({ rows: everyone, total: everyone.length })
    vi.mocked(playersApi.getPlayer).mockImplementation(
      async (id) => everyone.find((p) => p.id === id) ?? null,
    )
    vi.mocked(settingsApi.listPlans).mockResolvedValue(PLANS)
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS)
    vi.mocked(api.listReturningPlayers).mockResolvedValue([])
    vi.mocked(api.listApplicableDiscounts).mockResolvedValue([tenPercent])
    vi.mocked(api.createSubscription).mockResolvedValue('new-id')
  })

  describe('step 1 — players', () => {
    it('will not continue without a player', async () => {
      renderWizard()
      await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
      await next()
      expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one player.')
      expect(screen.getByText('Step 1 of 6', { exact: false })).toBeInTheDocument()
    })

    it('keeps the list on screen while it looks up which players are returning', async () => {
      vi.mocked(api.listReturningPlayers).mockReturnValue(new Promise(() => {})) // never resolves
      renderWizard()
      await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
      await pick('Yousef Al Mahmood')
      expect(await screen.findByText('Solo plan')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Ali Hassan' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    })

    it('waits for that lookup before showing fees', async () => {
      vi.mocked(api.listReturningPlayers).mockReturnValue(new Promise(() => {}))
      renderWizard()
      await choose('Yousef Al Mahmood')
      await next() // period → options
      expect(await screen.findByRole('button', { name: 'Next' })).toBeDisabled()
      expect(screen.queryByText('First subscription')).not.toBeInTheDocument()
    })

    it('sets the plan from the number of players, showing its price', async () => {
      renderWizard()
      await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
      expect(screen.queryByText(/plan$/)).not.toBeInTheDocument()

      await pick('Yousef Al Mahmood')
      expect(await screen.findByText('Solo plan')).toBeInTheDocument()
      expect(screen.getByText('20.000 BD per period')).toBeInTheDocument()

      await pick('Ali Hassan')
      expect(await screen.findByText('Duo plan')).toBeInTheDocument()
      expect(screen.getByText('35.000 BD per period')).toBeInTheDocument()

      await pick('Hamad Salman')
      expect(await screen.findByText('Trio plan')).toBeInTheDocument()
      await pick('Sara Khalid')
      expect(await screen.findByText('Quad plan')).toBeInTheDocument()
      expect(screen.getByText('60.000 BD per period')).toBeInTheDocument()
    })

    it('stops at four players and lets one be removed again', async () => {
      renderWizard()
      await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
      for (const p of [yousef, ali, hamad, sara]) await pick(p.full_name)
      expect(screen.getByRole('checkbox', { name: 'Omar Faisal' })).toBeDisabled()
      expect(screen.getByText('You can choose up to 4 players.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Remove Sara Khalid' }))
      expect(await screen.findByText('Trio plan')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Omar Faisal' })).toBeEnabled()
    })

    it('searches players', async () => {
      renderWizard()
      await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
      await userEvent.type(screen.getByRole('searchbox'), 'ali')
      await waitFor(() =>
        expect(vi.mocked(playersApi.listPlayers).mock.lastCall![0].search).toBe('ali'),
      )
    })
  })

  describe('step 2 — period', () => {
    it('defaults to today and one month minus a day, and follows the start until the end is edited', async () => {
      renderWizard()
      await choose('Yousef Al Mahmood')
      const start = await screen.findByLabelText(/Start date/)
      const end = screen.getByLabelText(/End date/)
      expect(start).toHaveValue(todayISO())
      expect(end).toHaveValue(defaultEndDate(todayISO()))

      fireEventChange(start, '2026-12-15')
      expect(end).toHaveValue('2027-01-14')
    })

    it('rejects an end date before the start', async () => {
      renderWizard()
      await choose('Yousef Al Mahmood')
      const end = await screen.findByLabelText(/End date/)
      fireEventChange(screen.getByLabelText(/Start date/), '2026-12-15')
      fireEventChange(end, '2026-12-01')
      await next()
      expect(
        await screen.findByText('The end date cannot be before the start date.'),
      ).toBeInTheDocument()
    })
  })

  describe('step 3 — options and the live total', () => {
    it('charges a first-time player the T-shirt, which a coach cannot waive', async () => {
      renderWizard('coach')
      await choose('Yousef Al Mahmood')
      await next() // dates
      expect(await screen.findByText('First subscription')).toBeInTheDocument()
      const tshirt = screen.getByRole('checkbox', { name: /T-shirt/ })
      expect(tshirt).toBeChecked()
      expect(tshirt).toBeDisabled()
      expect(screen.getByText('20.000 BD'.replace('20', '25'))).toBeInTheDocument() // 20 + 5 T-shirt
    })

    it('does not charge a returning player the T-shirt', async () => {
      vi.mocked(api.listReturningPlayers).mockResolvedValue(['p1'])
      renderWizard('coach')
      await choose('Yousef Al Mahmood')
      await next()
      expect(await screen.findByText('Returning player')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /T-shirt/ })).not.toBeChecked()
      expect(screen.getByText('20.000 BD')).toBeInTheDocument()
    })

    it('adds transport per player to the total', async () => {
      renderWizard('coach')
      await choose('Yousef Al Mahmood')
      await next()
      await userEvent.click(await screen.findByRole('checkbox', { name: /Transport/ }))
      expect(await screen.findByText('35.000 BD')).toBeInTheDocument() // 20 + 5 + 10
    })

    it('lets an admin waive the T-shirt for a first-time player', async () => {
      renderWizard('admin')
      await choose('Yousef Al Mahmood')
      await next()
      const tshirt = await screen.findByRole('checkbox', { name: /T-shirt/ })
      expect(tshirt).toBeEnabled()
      await userEvent.click(tshirt)
      expect(await screen.findByText('20.000 BD')).toBeInTheDocument()
    })
  })

  describe('step 4 — discount', () => {
    async function toDiscount(role: 'admin' | 'coach' = 'coach') {
      renderWizard(role)
      await choose('Yousef Al Mahmood')
      await next() // period
      await next() // options
    }

    it('applies a code and shows what it does, live', async () => {
      await toDiscount()
      await userEvent.click(await screen.findByRole('radio', { name: 'Discount code' }))
      await userEvent.type(screen.getByLabelText(/^Code/), 'sib10')
      expect(await screen.findByText('Sibling discount — 10% off')).toBeInTheDocument()
      expect(screen.getByText('22.500 BD')).toBeInTheDocument() // 25.000 − 10%
    })

    it('rejects an unknown code and will not continue', async () => {
      await toDiscount()
      await userEvent.click(await screen.findByRole('radio', { name: 'Discount code' }))
      await userEvent.type(screen.getByLabelText(/^Code/), 'nope')
      expect(
        await screen.findByText('This code does not exist or is not active.'),
      ).toBeInTheDocument()
      await next()
      expect(screen.getByText('Step 4 of 6', { exact: false })).toBeInTheDocument()
    })

    it('needs a reason for a manual discount, then updates the total', async () => {
      await toDiscount()
      await userEvent.click(await screen.findByRole('radio', { name: 'Manual discount' }))
      await userEvent.type(screen.getByLabelText(/^Percentage/), '12.5')
      await next()
      expect(await screen.findByText('Enter a reason.')).toBeInTheDocument()

      await userEvent.type(screen.getByLabelText(/^Reason/), 'Staff child')
      expect(await screen.findByText('21.875 BD')).toBeInTheDocument() // 25.000 − 3.125
      await next()
      expect(screen.getByText('Step 5 of 6', { exact: false })).toBeInTheDocument()
    })
  })

  describe('finishing', () => {
    async function toPayment() {
      renderWizard('coach')
      await choose('Yousef Al Mahmood')
      await next() // period
      await next() // options
      await next() // discount: none
      await next() // summary
      await screen.findByText('Payment', { selector: 'h2' })
    }

    it('shows a full breakdown before payment', async () => {
      renderWizard('coach')
      await choose('Yousef Al Mahmood')
      await next()
      await userEvent.click(await screen.findByRole('checkbox', { name: /Transport/ }))
      await next()
      await userEvent.click(await screen.findByRole('radio', { name: 'Discount code' }))
      await userEvent.type(screen.getByLabelText(/^Code/), 'SIB10')
      await next()
      // summary: 20 + 5 T-shirt + 10 transport = 35, −10% = 3.5 → 31.500
      expect(await screen.findByText('Plan price')).toBeInTheDocument()
      expect(screen.getByText('T-shirt fees')).toBeInTheDocument()
      expect(screen.getByText('Transport fees')).toBeInTheDocument()
      expect(screen.getByText('Code SIB10 · 10%')).toBeInTheDocument()
      expect(screen.getAllByText('31.500 BD').length).toBeGreaterThan(0)
    })

    it('creates a paid-in-full subscription by default and opens it', async () => {
      await toPayment()
      expect(screen.getByRole('radio', { name: 'Paid in full today' })).toBeChecked()
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      await waitFor(() => expect(api.createSubscription).toHaveBeenCalled())
      expect(vi.mocked(api.createSubscription).mock.calls[0]![0]).toEqual({
        p_start_date: todayISO(),
        p_end_date: defaultEndDate(todayISO()),
        p_players: [{ player_id: 'p1', transport: false }],
        p_initial_payment_fils: 25000,
        p_payment_method: 'cash',
      })
      expect(await screen.findByText('detail page')).toBeInTheDocument()
      expect(await screen.findByText('Subscription created')).toBeInTheDocument()
    })

    it('records only what was received for a part payment, with the chosen method', async () => {
      await toPayment()
      await userEvent.click(screen.getByRole('radio', { name: 'Part payment now' }))
      await userEvent.type(screen.getByLabelText(/Amount received/), '99')
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      expect(
        await screen.findByText('Enter an amount between 0.001 and the total.'),
      ).toBeInTheDocument()
      expect(api.createSubscription).not.toHaveBeenCalled()

      const amount = screen.getByLabelText(/Amount received/)
      await userEvent.clear(amount)
      await userEvent.type(amount, '10')
      await userEvent.selectOptions(screen.getByLabelText('Payment method'), 'benefit')
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      await waitFor(() => expect(api.createSubscription).toHaveBeenCalled())
      expect(vi.mocked(api.createSubscription).mock.calls[0]![0]).toMatchObject({
        p_initial_payment_fils: 10000,
        p_payment_method: 'benefit',
      })
    })

    it('records no payment when it is left unpaid', async () => {
      await toPayment()
      await userEvent.click(screen.getByRole('radio', { name: 'Not paid yet' }))
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      await waitFor(() => expect(api.createSubscription).toHaveBeenCalled())
      expect(vi.mocked(api.createSubscription).mock.calls[0]![0]).not.toHaveProperty(
        'p_initial_payment_fils',
      )
    })

    it('names the players and returns to the dates when they already have a subscription then', async () => {
      vi.mocked(api.createSubscription).mockRejectedValue({
        message: 'ajyal:overlap',
        code: '23P01',
        details: 'p1',
      })
      await toPayment()
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      expect(
        await screen.findByText(
          'Yousef Al Mahmood already has a subscription that overlaps these dates.',
        ),
      ).toBeInTheDocument()
      expect(await screen.findByLabelText(/Start date/)).toBeInTheDocument() // back on the period step
    })

    it('shows a translated message for a rejected discount code', async () => {
      vi.mocked(api.createSubscription).mockRejectedValue({
        message: 'ajyal:discount_exhausted',
        code: '22023',
      })
      await toPayment()
      await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }))
      expect(
        await screen.findByText('This code has been used the maximum number of times.'),
      ).toBeInTheDocument()
    })
  })

  it('starts at the period step with the player already chosen when opened from a player', async () => {
    renderWizard('coach', '?player=p2')
    expect(await screen.findByLabelText(/Start date/)).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 6', { exact: false })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Solo plan')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ali Hassan' })).toBeChecked()
  })

  it('goes back to the list from the first step', async () => {
    const router = renderWizard('admin')
    await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(router.state.location.pathname).toBe('/admin/subscriptions')
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderWizard()
    expect(await screen.findByRole('heading', { name: 'اشتراك جديد' })).toBeInTheDocument()
    await screen.findByRole('checkbox', { name: 'Yousef Al Mahmood' })
    await pick('Yousef Al Mahmood')
    expect(await screen.findByText('باقة فردية')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getByText(/الخطوة 1 من 6/)).toBeInTheDocument()
  })
})
