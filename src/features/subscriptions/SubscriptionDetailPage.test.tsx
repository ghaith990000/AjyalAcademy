import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import { todayISO } from '@/lib/dates'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import { fakeSubscription } from '@/test/subscriptions'
import * as api from './api'
import SubscriptionDetailPage from './SubscriptionDetailPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getSubscription: vi.fn(),
  getSubscriptionPlayers: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  getDiscountLabel: vi.fn(),
  recordPayment: vi.fn(),
  cancelSubscription: vi.fn(),
}))

// 20 plan + 5 T-shirt + 10 transport = 35, 10% code = 3.5 → 31.5; paid 10.
const partlyPaid = fakeSubscription({
  id: 'sub',
  plan_code: 'duo',
  plan_price_fils: 35000,
  tshirt_total_fils: 5000,
  transport_total_fils: 10000,
  discount_id: 'd1',
  discount_type: 'percent',
  discount_value: 1000,
  discount_fils: 5000,
  total_fils: 45000,
  paid_fils: 30000,
  balance_fils: 15000,
  player_names: 'Ali Hassan, Yousef Al Mahmood',
  player_count: 2,
})
const players = [
  {
    player_id: 'p1',
    tshirt_fee_fils: 5000,
    transport_fee_fils: 10000,
    player: { id: 'p1', full_name: 'Yousef Al Mahmood' },
  },
  {
    player_id: 'p2',
    tshirt_fee_fils: 0,
    transport_fee_fils: 0,
    player: { id: 'p2', full_name: 'Ali Hassan' },
  },
]
const payments = [
  {
    id: 'pay2',
    amount_fils: 10000,
    paid_at: '2026-10-05',
    method: 'benefit' as const,
    note: 'Ref 77',
    created_at: '2026-10-05T10:00:00Z',
    received: { full_name: 'Khalid Al Dosari' },
  },
  {
    id: 'pay1',
    amount_fils: 20000,
    paid_at: '2026-10-01',
    method: 'cash' as const,
    note: null,
    created_at: '2026-10-01T10:00:00Z',
    received: null,
  },
]

function renderDetail(id = 'sub', role: 'admin' | 'coach' = 'admin') {
  const prefix = `/${role}/subscriptions`
  const router = createMemoryRouter(
    [
      { path: prefix, element: <p>list page</p> },
      { path: `${prefix}/:id`, element: <SubscriptionDetailPage /> },
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

describe('SubscriptionDetailPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.getSubscription).mockImplementation(async (id) =>
      id === 'sub' ? partlyPaid : null,
    )
    vi.mocked(api.getSubscriptionPlayers).mockResolvedValue(players)
    vi.mocked(api.getSubscriptionPayments).mockResolvedValue(payments)
    vi.mocked(api.getDiscountLabel).mockResolvedValue({ name: 'Sibling', code: 'SIB10' })
  })

  it('shows the plan, status, period, players with their fees, and links to each player', async () => {
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Duo subscription' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('01/10/2026 – 31/10/2026')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Yousef Al Mahmood' })
    expect(link).toHaveAttribute('href', '/admin/players/p1')
    const playersCard = screen.getByRole('heading', { name: 'Players' }).closest('div')!
    expect(playersCard).toHaveTextContent('T-shirt · 5.000 BD')
    expect(playersCard).toHaveTextContent('Transport · 10.000 BD')
  })

  it('itemises the price, the discount and what is paid and owed', async () => {
    renderDetail()
    await screen.findByRole('heading', { name: 'Duo subscription' })
    const dl = screen.getByText('Plan price').closest('dl')!
    expect(within(dl).getByText('35.000 BD')).toBeInTheDocument()
    expect(within(dl).getByText('T-shirt fees')).toBeInTheDocument()
    expect(within(dl).getByText('Transport fees')).toBeInTheDocument()
    expect(within(dl).getByText('Subtotal')).toBeInTheDocument()
    expect(within(dl).getByText('Discount').closest('div')).toHaveTextContent('−5.000 BD')
    expect(await within(dl).findByText('Code SIB10 · 10%')).toBeInTheDocument()
    expect(within(dl).getByText('45.000 BD')).toBeInTheDocument()
    expect(within(dl).getByText('30.000 BD')).toBeInTheDocument() // paid
    expect(within(dl).getByText('15.000 BD')).toBeInTheDocument() // balance
  })

  it('shows a manual discount with its reason', async () => {
    vi.mocked(api.getSubscription).mockResolvedValue({
      ...partlyPaid,
      discount_id: null,
      discount_reason: 'Staff child',
    })
    renderDetail()
    expect(await screen.findByText('Manual — Staff child')).toBeInTheDocument()
  })

  it('lists payments with method, date, note and who received them', async () => {
    renderDetail()
    expect(await screen.findByText(/Benefit/)).toBeInTheDocument()
    expect(screen.getByText(/Received by Khalid Al Dosari/)).toBeInTheDocument()
    expect(screen.getByText('Ref 77')).toBeInTheDocument()
    expect(screen.getByText(/05\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Cash/)).toBeInTheDocument()
  })

  it('says so when there are no payments', async () => {
    vi.mocked(api.getSubscriptionPayments).mockResolvedValue([])
    renderDetail()
    expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument()
  })

  describe('adding a payment', () => {
    async function openDialog() {
      await userEvent.click(await screen.findByRole('button', { name: 'Add payment' }))
      return await screen.findByRole('dialog', { name: 'Add payment' })
    }

    it('defaults to the whole balance, today and cash, and records it', async () => {
      vi.mocked(api.recordPayment).mockResolvedValue('pay3')
      renderDetail()
      const dialog = await openDialog()
      expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('15')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
      await waitFor(() =>
        expect(api.recordPayment).toHaveBeenCalledWith({
          p_subscription_id: 'sub',
          p_amount_fils: 15000,
          p_method: 'cash',
          p_paid_at: todayISO(),
        }),
      )
      expect(await screen.findByText('Payment recorded')).toBeInTheDocument()
    })

    it('sends the chosen amount, method and note', async () => {
      vi.mocked(api.recordPayment).mockResolvedValue('pay3')
      renderDetail()
      const dialog = await openDialog()
      const amount = within(dialog).getByLabelText(/Amount/)
      await userEvent.clear(amount)
      await userEvent.type(amount, '7.5')
      await userEvent.selectOptions(
        within(dialog).getByLabelText(/^Payment method/),
        'bank_transfer',
      )
      await userEvent.type(within(dialog).getByLabelText(/Note/), 'Ref 9')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
      await waitFor(() => expect(api.recordPayment).toHaveBeenCalled())
      expect(vi.mocked(api.recordPayment).mock.calls[0]![0]).toMatchObject({
        p_amount_fils: 7500,
        p_method: 'bank_transfer',
        p_note: 'Ref 9',
      })
    })

    it('refuses an amount above the balance, or one that is not an amount', async () => {
      renderDetail()
      const dialog = await openDialog()
      const amount = within(dialog).getByLabelText(/Amount/)
      await userEvent.clear(amount)
      await userEvent.type(amount, '15.001')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
      expect(
        await within(dialog).findByText('The amount is more than the balance'),
      ).toBeInTheDocument()

      await userEvent.clear(amount)
      await userEvent.type(amount, 'abc')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
      expect(
        await within(dialog).findByText('Enter an amount such as 10 or 12.500'),
      ).toBeInTheDocument()
      expect(api.recordPayment).not.toHaveBeenCalled()
    })

    it("shows the server's reason when it refuses the payment", async () => {
      vi.mocked(api.recordPayment).mockRejectedValue({
        message: 'ajyal:overpayment',
        code: '22003',
      })
      renderDetail()
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
      expect(
        await screen.findByText('The payment is more than the amount due.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('cancelling', () => {
    async function openDialog() {
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel subscription' }))
      return await screen.findByRole('dialog', { name: 'Cancel this subscription?' })
    }

    it('asks for a reason and does nothing without one', async () => {
      renderDetail()
      const dialog = await openDialog()
      expect(within(dialog).getByText(/Payments already recorded are kept/)).toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }))
      expect(await within(dialog).findByText('Enter a reason')).toBeInTheDocument()
      expect(api.cancelSubscription).not.toHaveBeenCalled()
    })

    it('cancels with the trimmed reason', async () => {
      vi.mocked(api.cancelSubscription).mockResolvedValue(undefined)
      renderDetail()
      const dialog = await openDialog()
      await userEvent.type(within(dialog).getByLabelText(/Reason/), '  Moved away ')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }))
      await waitFor(() => expect(api.cancelSubscription).toHaveBeenCalledWith('sub', 'Moved away'))
      expect(await screen.findByText('Subscription cancelled')).toBeInTheDocument()
    })

    it('can be dismissed with "Keep it"', async () => {
      renderDetail()
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }))
      expect(api.cancelSubscription).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows a cancelled subscription with its reason and no actions', async () => {
    vi.mocked(api.getSubscription).mockResolvedValue({
      ...partlyPaid,
      status: 'cancelled',
      cancelled_at: '2026-10-10T08:00:00Z',
      cancel_reason: 'Moved away',
    })
    renderDetail()
    expect(await screen.findByText('Cancelled on 10/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Reason: Moved away')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add payment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('has no "Add payment" once fully paid, and says so', async () => {
    vi.mocked(api.getSubscription).mockResolvedValue({
      ...partlyPaid,
      paid_fils: 45000,
      balance_fils: 0,
    })
    renderDetail()
    expect(await screen.findByText('Fully paid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add payment' })).not.toBeInTheDocument()
  })

  it("hides another coach's player from a coach, and keeps links in the coach area", async () => {
    vi.mocked(api.getSubscriptionPlayers).mockResolvedValue([
      players[0]!,
      { player_id: 'p9', tshirt_fee_fils: 0, transport_fee_fils: 0, player: null },
    ])
    renderDetail('sub', 'coach')
    expect(await screen.findByRole('link', { name: 'Yousef Al Mahmood' })).toHaveAttribute(
      'href',
      '/coach/players/p1',
    )
    expect(screen.getByText('+1 with another coach')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to subscriptions' })).toHaveAttribute(
      'href',
      '/coach/subscriptions',
    )
  })

  it('shows "not found" and a retry when loading fails', async () => {
    const router = renderDetail('nope')
    expect(await screen.findByText('Subscription not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Back to subscriptions' }))
    expect(router.state.location.pathname).toBe('/admin/subscriptions')

    vi.mocked(api.getSubscription).mockRejectedValueOnce(new Error('boom'))
    document.body.innerHTML = ''
    renderDetail('sub')
    expect(await screen.findByText("Couldn't load this subscription")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Duo subscription' })).toBeInTheDocument()
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'اشتراك ثنائية' })).toBeInTheDocument()
    expect(screen.getAllByText('45.000 د.ب').length).toBeGreaterThan(0)
  })
})
