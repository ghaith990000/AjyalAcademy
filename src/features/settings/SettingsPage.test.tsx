import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { PLANS, SETTINGS } from '@/test/subscriptions'
import * as api from './api'
import SettingsPage from './SettingsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listPlans: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}))

function renderPage() {
  return render(
    <Providers>
      <SettingsPage />
    </Providers>,
  )
}

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listPlans).mockResolvedValue(PLANS)
    vi.mocked(api.getSettings).mockResolvedValue(SETTINGS)
  })

  it('shows the current prices, fees and reminder window', async () => {
    renderPage()
    expect(await screen.findByLabelText(/Solo/)).toHaveValue('20')
    expect(screen.getByLabelText(/Duo/)).toHaveValue('35')
    expect(screen.getByLabelText(/Trio/)).toHaveValue('50')
    expect(screen.getByLabelText(/Quad/)).toHaveValue('60')
    expect(screen.getByLabelText(/T-shirt fee/)).toHaveValue('5')
    expect(screen.getByLabelText(/Transport fee/)).toHaveValue('10')
    expect(screen.getByLabelText(/Expiring soon/)).toHaveValue('7')
  })

  it('cannot be saved until something changes', async () => {
    renderPage()
    await screen.findByLabelText(/Solo/)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Solo/), '5')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('saves every value as integer fils / whole days', async () => {
    vi.mocked(api.saveSettings).mockResolvedValue(undefined)
    renderPage()
    const solo = await screen.findByLabelText(/Solo/)
    await userEvent.clear(solo)
    await userEvent.type(solo, '22.5')
    const tshirt = screen.getByLabelText(/T-shirt fee/)
    await userEvent.clear(tshirt)
    await userEvent.type(tshirt, '6,250')
    const days = screen.getByLabelText(/Expiring soon/)
    await userEvent.clear(days)
    await userEvent.type(days, '14')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled())
    expect(vi.mocked(api.saveSettings).mock.calls[0]![0]).toEqual({
      planPrices: [
        { id: 'plan-solo', price_fils: 22500 },
        { id: 'plan-duo', price_fils: 35000 },
        { id: 'plan-trio', price_fils: 50000 },
        { id: 'plan-quad', price_fils: 60000 },
      ],
      tshirt_fee_fils: 6250,
      transport_fee_fils: 10000,
      expiring_soon_days: 14,
    })
    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled() // saved values are the new baseline
  })

  it('rejects amounts that are not BD amounts, and does not save', async () => {
    renderPage()
    const duo = await screen.findByLabelText(/Duo/)
    await userEvent.clear(duo)
    await userEvent.type(duo, '12.3456')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Enter an amount such as 20 or 12.500')).toBeInTheDocument()

    await userEvent.clear(duo)
    await userEvent.type(duo, '5000')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('The amount is too high')).toBeInTheDocument()

    const days = screen.getByLabelText(/Expiring soon/)
    await userEvent.clear(days)
    await userEvent.type(days, '1.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Enter a whole number of days (0–99)')).toBeInTheDocument()
    expect(api.saveSettings).not.toHaveBeenCalled()
  })

  it('shows a translated error and stays editable when saving fails', async () => {
    vi.mocked(api.saveSettings).mockRejectedValue({ code: '42501', message: 'nope' })
    renderPage()
    const solo = await screen.findByLabelText(/Solo/)
    await userEvent.type(solo, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText("You don't have permission to do that.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('offers a retry when loading fails', async () => {
    vi.mocked(api.getSettings).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load the settings")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText(/Solo/)).toBeInTheDocument()
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByLabelText(/فردية/)).toHaveValue('20')
    expect(screen.getByText('أسعار الباقات')).toBeInTheDocument()
  })
})
