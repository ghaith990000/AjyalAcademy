import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import * as api from './api'
import DiscountsPage from './DiscountsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listDiscounts: vi.fn(),
  createDiscount: vi.fn(),
  updateDiscount: vi.fn(),
}))

const base = { created_by: null, created_at: '2026-01-01T00:00:00Z' }
const sibling: api.DiscountWithUses = {
  ...base,
  id: 'd1',
  name: 'Sibling discount',
  code: 'SIBLING10',
  type: 'percent',
  value: 1250,
  valid_from: null,
  valid_to: null,
  max_uses: null,
  active: true,
  uses: 4,
}
const october: api.DiscountWithUses = {
  ...base,
  id: 'd2',
  name: 'October promo',
  code: 'OCT5',
  type: 'fixed',
  value: 5000,
  valid_from: '2026-10-01',
  valid_to: '2026-10-31',
  max_uses: 20,
  active: false,
  uses: 20,
}

function renderPage() {
  return render(
    <Providers>
      <DiscountsPage />
    </Providers>,
  )
}

describe('DiscountsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listDiscounts).mockResolvedValue([sibling, october])
  })

  it('lists codes with value, validity, usage and status', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Discounts' })).toBeInTheDocument()
    expect((await screen.findAllByText('SIBLING10')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('12.5%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5.000 BD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Always').length).toBeGreaterThan(0)
    expect(screen.getAllByText('01/10/2026 – 31/10/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4 used').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20 of 20 used').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })

  it('has an empty state and a retry state', async () => {
    vi.mocked(api.listDiscounts).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No discounts yet')).toBeInTheDocument()

    document.body.innerHTML = ''
    vi.mocked(api.listDiscounts).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load discounts")).toBeInTheDocument()
    vi.mocked(api.listDiscounts).mockResolvedValue([sibling])
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('SIBLING10')).length).toBeGreaterThan(0)
  })

  describe('adding a discount', () => {
    async function openForm() {
      renderPage()
      await screen.findAllByText('SIBLING10')
      await userEvent.click(screen.getAllByRole('button', { name: 'Add discount' })[0]!)
      return await screen.findByRole('dialog', { name: 'Add discount' })
    }

    it('validates before calling the server', async () => {
      const dialog = await openForm()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))
      expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument()
      expect(within(dialog).getByText('Use 2–30 letters, digits, - or _')).toBeInTheDocument()
      expect(
        within(dialog).getByText('Enter a percentage between 0.01 and 100'),
      ).toBeInTheDocument()
      expect(api.createDiscount).not.toHaveBeenCalled()
    })

    it('switches the value field with the type', async () => {
      const dialog = await openForm()
      expect(within(dialog).getByLabelText(/Percentage \(%\)/)).toBeInTheDocument()
      await userEvent.selectOptions(within(dialog).getByLabelText(/^Type/), 'fixed')
      expect(within(dialog).getByLabelText(/Amount \(BD\)/)).toBeInTheDocument()
    })

    it('creates a percent discount stored as basis points, with the code upper-cased', async () => {
      vi.mocked(api.createDiscount).mockResolvedValue(undefined)
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Friends')
      await userEvent.type(within(dialog).getByLabelText(/^Code/), 'friends15')
      await userEvent.type(within(dialog).getByLabelText(/Percentage \(%\)/), '15')
      await userEvent.type(within(dialog).getByLabelText(/Maximum uses/), '10')
      fireEvent.change(within(dialog).getByLabelText(/Valid until/), {
        target: { value: '2026-12-31' },
      })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))
      await waitFor(() => expect(api.createDiscount).toHaveBeenCalled())
      expect(vi.mocked(api.createDiscount).mock.calls[0]![0]).toEqual({
        name: 'Friends',
        code: 'FRIENDS15',
        type: 'percent',
        value: 1500,
        valid_from: null,
        valid_to: '2026-12-31',
        max_uses: 10,
        active: true,
      })
      expect(await screen.findByText('Discount added')).toBeInTheDocument()
    })

    it('creates a fixed discount stored as fils', async () => {
      vi.mocked(api.createDiscount).mockResolvedValue(undefined)
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Five off')
      await userEvent.type(within(dialog).getByLabelText(/^Code/), 'FIVE')
      await userEvent.selectOptions(within(dialog).getByLabelText(/^Type/), 'fixed')
      await userEvent.type(within(dialog).getByLabelText(/Amount \(BD\)/), '2.5')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))
      await waitFor(() => expect(api.createDiscount).toHaveBeenCalled())
      expect(vi.mocked(api.createDiscount).mock.calls[0]![0]).toMatchObject({
        type: 'fixed',
        value: 2500,
      })
    })

    it('reports a duplicate code on the code field and stays open', async () => {
      vi.mocked(api.createDiscount).mockRejectedValue(new api.DuplicateCodeError())
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Again')
      await userEvent.type(within(dialog).getByLabelText(/^Code/), 'sibling10')
      await userEvent.type(within(dialog).getByLabelText(/Percentage \(%\)/), '5')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))
      expect(await within(dialog).findByText('This code already exists')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('editing a discount', () => {
    it('prefills the form (percent as typed, fixed in BD) and saves changes', async () => {
      vi.mocked(api.updateDiscount).mockResolvedValue(undefined)
      renderPage()
      await userEvent.click((await screen.findAllByText('SIBLING10'))[0]!)
      const dialog = await screen.findByRole('dialog', { name: 'Edit discount' })
      expect(within(dialog).getByLabelText(/^Code/)).toHaveValue('SIBLING10')
      expect(within(dialog).getByLabelText(/Percentage \(%\)/)).toHaveValue('12.5')

      await userEvent.click(within(dialog).getByRole('switch', { name: /Active/ }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(api.updateDiscount).toHaveBeenCalled())
      const [id, input] = vi.mocked(api.updateDiscount).mock.calls[0]!
      expect(id).toBe('d1')
      expect(input).toMatchObject({ value: 1250, active: false })
      expect(await screen.findByText('Discount updated')).toBeInTheDocument()
    })

    it('shows a fixed discount in BD and its validity dates', async () => {
      renderPage()
      await userEvent.click((await screen.findAllByText('OCT5'))[0]!)
      const dialog = await screen.findByRole('dialog', { name: 'Edit discount' })
      expect(within(dialog).getByLabelText(/Amount \(BD\)/)).toHaveValue('5')
      expect(within(dialog).getByLabelText(/Valid from/)).toHaveValue('2026-10-01')
      expect(within(dialog).getByLabelText(/Maximum uses/)).toHaveValue('20')
    })
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'الخصومات' })).toBeInTheDocument()
    expect((await screen.findAllByText('استُخدم 4')).length).toBeGreaterThan(0)
  })
})
