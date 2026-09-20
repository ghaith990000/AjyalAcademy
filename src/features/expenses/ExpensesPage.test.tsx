import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import * as coachesApi from '@/features/coaches/api'
import * as reportsApi from '@/features/reports/api'
import i18n from '@/lib/i18n'
import { fakeProfile } from '@/test/auth'
import { fakeExpense, OCTOBER_CATEGORIES } from '@/test/finance'
import * as api from './api'
import ExpensesPage from './ExpensesPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  generateMonthlySalaries: vi.fn(),
}))
vi.mock('@/features/reports/api', async (importOriginal) => ({
  ...(await importOriginal<typeof reportsApi>()),
  getExpensesByCategory: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const khalid = fakeProfile('coach', {
  id: 'c1',
  full_name: 'Khalid Al Dosari',
  monthly_salary_fils: 150_000,
})
const sara = fakeProfile('coach', {
  id: 'c2',
  full_name: 'Sara Al Khalifa',
  monthly_salary_fils: 100_000,
})
const retired = fakeProfile('coach', {
  id: 'c3',
  full_name: 'Old Coach',
  monthly_salary_fils: 90_000,
  active: false,
})

const rent = fakeExpense({ id: 'e-rent', description: 'Pitch, hall A' })
const salary = fakeExpense({
  id: 'e-salary',
  category: 'coach_salary',
  amount_fils: 150_000,
  expense_date: '2026-10-01',
  coach_id: 'c1',
  coach: { full_name: 'Khalid Al Dosari' },
})

function renderPage() {
  return render(
    <Providers>
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    </Providers>,
  )
}

// "Today" is 19 October 2026, so the page opens on October.
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }
const SEPTEMBER = { from: '2026-09-01', to: '2026-09-30' }

describe('ExpensesPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 12))
    await i18n.changeLanguage('en')
    vi.mocked(api.listExpenses).mockResolvedValue({ rows: [salary, rent], total: 2 })
    vi.mocked(reportsApi.getExpensesByCategory).mockResolvedValue(OCTOBER_CATEGORIES)
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([khalid, sara, retired])
  })
  afterEach(() => vi.useRealTimers())

  it("lists the month's expenses with category, coach, note and amount, and the month's total", async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect((await screen.findAllByText('Coach salary · Khalid Al Dosari')).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByText('Field rent').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pitch, hall A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('150.000 BD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50.000 BD').length).toBeGreaterThan(0)
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('Total for October 2026')).toBeInTheDocument()
    expect(await screen.findByText('210.000 BD')).toBeInTheDocument()
    expect(api.listExpenses).toHaveBeenCalledWith(
      { range: OCTOBER, category: 'all', locationId: '' },
      0,
    )
    expect(reportsApi.getExpensesByCategory).toHaveBeenCalledWith(OCTOBER, undefined)
  })

  it('filters by category chip and shows that category alongside the total', async () => {
    renderPage()
    await screen.findAllByText('Field rent')
    const chips = screen.getByRole('group', { name: 'Category' })
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(within(chips).getByRole('button', { name: 'Field rent' }))

    expect(within(chips).getByRole('button', { name: 'Field rent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() =>
      expect(api.listExpenses).toHaveBeenLastCalledWith(
        { range: OCTOBER, category: 'field_rent', locationId: '' },
        0,
      ),
    )
    // the total bar now shows the month and the chosen category
    expect((await screen.findAllByText('50.000 BD')).length).toBeGreaterThan(1)
  })

  it('moves between months, and cannot go past the current one', async () => {
    renderPage()
    await screen.findAllByText('Field rent')
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(await screen.findByText('September 2026')).toBeInTheDocument()
    await waitFor(() =>
      expect(api.listExpenses).toHaveBeenLastCalledWith(
        { range: SEPTEMBER, category: 'all', locationId: '' },
        0,
      ),
    )
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })

  it('has an empty state and a retry state', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue({ rows: [], total: 0 })
    vi.mocked(reportsApi.getExpensesByCategory).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No expenses in October 2026')).toBeInTheDocument()
    expect(await screen.findByText('0.000 BD')).toBeInTheDocument()

    document.body.innerHTML = ''
    vi.mocked(api.listExpenses).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load expenses")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No expenses in October 2026')).toBeInTheDocument()
  })

  it('keeps working when only the totals fail to load', async () => {
    vi.mocked(reportsApi.getExpensesByCategory).mockRejectedValue(new Error('boom'))
    renderPage()
    expect((await screen.findAllByText('Field rent')).length).toBeGreaterThan(0)
    expect(screen.getByText('Total for October 2026').nextElementSibling).toHaveTextContent('—')
  })

  it('offers "show more" when the month has more expenses than one page', async () => {
    vi.mocked(api.listExpenses)
      .mockResolvedValueOnce({ rows: [salary], total: 2 })
      .mockResolvedValueOnce({ rows: [rent], total: 2 })
    renderPage()
    expect(await screen.findByText('Showing 1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Showing 2 of 2')).toBeInTheDocument()
    expect(api.listExpenses).toHaveBeenLastCalledWith(
      { range: OCTOBER, category: 'all', locationId: '' },
      1,
    )
  })

  describe('by location', () => {
    it("shows each expense's location, or that it is for the whole academy", async () => {
      vi.mocked(api.listExpenses).mockResolvedValue({
        rows: [
          fakeExpense({ id: 'e-a', location_id: 'loc-1', location: { name: 'Al-Rifa' } }),
          fakeExpense({ id: 'e-b', category: 'equipment' }),
        ],
        total: 2,
      })
      renderPage()
      expect((await screen.findAllByText('Al-Rifa')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Academy-wide').length).toBeGreaterThan(0)
    })

    it('filters the list and the month total by location', async () => {
      renderPage()
      await screen.findAllByText('Pitch, hall A')
      await screen.findByRole('option', { name: 'Hamad City' })
      await userEvent.selectOptions(screen.getByLabelText('Location'), 'loc-2')
      await waitFor(() =>
        expect(api.listExpenses).toHaveBeenLastCalledWith(
          { range: OCTOBER, category: 'all', locationId: 'loc-2' },
          0,
        ),
      )
      expect(reportsApi.getExpensesByCategory).toHaveBeenLastCalledWith(OCTOBER, 'loc-2')
    })
  })

  describe('adding an expense', () => {
    async function openForm() {
      renderPage()
      await screen.findAllByText('Field rent')
      await userEvent.click(screen.getAllByRole('button', { name: 'Add expense' })[0]!)
      return screen.findByRole('dialog', { name: 'Add expense' })
    }

    it('validates before saving', async () => {
      const dialog = await openForm()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      expect(await within(dialog).findByText(/Enter an amount above zero/)).toBeInTheDocument()
      expect(api.createExpense).not.toHaveBeenCalled()
    })

    it('refuses a future date', async () => {
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Amount/), '10')
      const date = within(dialog).getByLabelText(/Date/)
      await userEvent.clear(date)
      await userEvent.type(date, '2026-10-20')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      expect(await within(dialog).findByText("The date can't be in the future")).toBeInTheDocument()
      expect(api.createExpense).not.toHaveBeenCalled()
    })

    it('saves in integer fils, dated today, and closes', async () => {
      vi.mocked(api.createExpense).mockResolvedValue()
      const dialog = await openForm()
      expect(within(dialog).getByLabelText(/Date/)).toHaveValue('2026-10-19')
      await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), 'transportation')
      await userEvent.type(within(dialog).getByLabelText(/Amount/), '12.5')
      await userEvent.type(within(dialog).getByLabelText(/Note/), 'Bus hire')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))

      await waitFor(() =>
        expect(api.createExpense).toHaveBeenCalledWith({
          category: 'transportation',
          amount_fils: 12_500,
          expense_date: '2026-10-19',
          coach_id: null,
          description: 'Bus hire',
          location_id: null,
        }),
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByText('Expense added')).toBeInTheDocument()
    })

    it("asks which coach for a salary and fills in that coach's monthly salary", async () => {
      vi.mocked(api.createExpense).mockResolvedValue()
      const dialog = await openForm()
      expect(within(dialog).queryByLabelText(/Coach/)).not.toBeInTheDocument()
      await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), 'coach_salary')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      expect(
        await within(dialog).findByText('Choose the coach this salary is for'),
      ).toBeInTheDocument()

      const coach = within(dialog).getByLabelText(/Coach/)
      expect(
        within(coach).getByRole('option', { name: 'Old Coach (inactive)' }),
      ).toBeInTheDocument()
      await userEvent.selectOptions(coach, 'c2')
      expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('100')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      await waitFor(() =>
        expect(api.createExpense).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'coach_salary',
            coach_id: 'c2',
            amount_fils: 100_000,
          }),
        ),
      )
    })

    it('clears the amount error once choosing the coach fills the amount in', async () => {
      const dialog = await openForm()
      await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), 'coach_salary')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      expect(await within(dialog).findByText(/Enter an amount above zero/)).toBeInTheDocument()

      await userEvent.selectOptions(within(dialog).getByLabelText(/Coach/), 'c2')

      expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('100')
      await waitFor(() =>
        expect(within(dialog).queryByText(/Enter an amount above zero/)).not.toBeInTheDocument(),
      )
    })

    it('does not overwrite an amount that was typed before choosing the coach', async () => {
      const dialog = await openForm()
      await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), 'coach_salary')
      await userEvent.type(within(dialog).getByLabelText(/Amount/), '75')
      await userEvent.selectOptions(within(dialog).getByLabelText(/Coach/), 'c1')
      expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('75')
    })

    it('shows the database rule as a translated message when the server refuses', async () => {
      vi.mocked(api.createExpense).mockRejectedValue(new Error('ajyal:future_date'))
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Amount/), '10')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }))
      expect(await screen.findByText("The date can't be in the future.")).toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
    })

    it('dates a new expense on the last day of a past month being viewed', async () => {
      renderPage()
      await screen.findAllByText('Field rent')
      await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
      await screen.findByText('September 2026')
      await userEvent.click(screen.getAllByRole('button', { name: 'Add expense' })[0]!)
      const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
      expect(within(dialog).getByLabelText(/Date/)).toHaveValue('2026-09-30')
    })
  })

  describe('editing and deleting', () => {
    async function openRow(text: string) {
      renderPage()
      await userEvent.click((await screen.findAllByText(text))[0]!)
      return screen.findByRole('dialog', { name: 'Edit expense' })
    }

    it('opens a row with its values and saves changes', async () => {
      vi.mocked(api.updateExpense).mockResolvedValue()
      const dialog = await openRow('Pitch, hall A')
      expect(within(dialog).getByLabelText(/Category/)).toHaveValue('field_rent')
      expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('50')
      expect(within(dialog).getByLabelText(/Note/)).toHaveValue('Pitch, hall A')

      const amount = within(dialog).getByLabelText(/Amount/)
      await userEvent.clear(amount)
      await userEvent.type(amount, '55.250')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

      await waitFor(() =>
        expect(api.updateExpense).toHaveBeenCalledWith('e-rent', {
          category: 'field_rent',
          amount_fils: 55_250,
          expense_date: '2026-10-15',
          coach_id: null,
          description: 'Pitch, hall A',
          location_id: null,
        }),
      )
      expect(await screen.findByText('Expense updated')).toBeInTheDocument()
    })

    it('asks before deleting, and deletes on confirmation', async () => {
      vi.mocked(api.deleteExpense).mockResolvedValue()
      const dialog = await openRow('Pitch, hall A')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete this expense' }))

      const confirm = await screen.findByRole('dialog', { name: 'Delete this expense?' })
      expect(within(confirm).getByText(/Field rent/)).toBeInTheDocument()
      expect(api.deleteExpense).not.toHaveBeenCalled()

      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(api.deleteExpense).toHaveBeenCalledWith('e-rent'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByText('Expense deleted')).toBeInTheDocument()
    })

    it('keeps the expense when the person changes their mind', async () => {
      const dialog = await openRow('Pitch, hall A')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete this expense' }))
      const confirm = await screen.findByRole('dialog', { name: 'Delete this expense?' })
      await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }))
      expect(api.deleteExpense).not.toHaveBeenCalled()
      expect(await screen.findByRole('dialog', { name: 'Edit expense' })).toBeInTheDocument()
    })
  })

  describe('generating salaries', () => {
    async function openDialog() {
      renderPage()
      await screen.findAllByText('Field rent')
      await userEvent.click(screen.getByRole('button', { name: 'Generate salaries' }))
      return screen.findByRole('dialog', { name: 'Generate monthly salaries' })
    }

    it('previews the active coaches with a salary and their total for the month', async () => {
      const dialog = await openDialog()
      expect(within(dialog).getByText('October 2026')).toBeInTheDocument()
      // Khalid + Sara; the inactive coach is left out
      expect(
        await within(dialog).findByText(/Coaches with a monthly salary: 2/),
      ).toBeInTheDocument()
      expect(within(dialog).getByText('250.000 BD')).toBeInTheDocument()
    })

    it('runs for the chosen month and reports what was created and skipped', async () => {
      vi.mocked(api.generateMonthlySalaries).mockResolvedValue({
        created: 1,
        skipped: 1,
        totalFils: 100_000,
      })
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Previous month' }))
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Generate' }))

      await waitFor(() => expect(api.generateMonthlySalaries).toHaveBeenCalledWith('2026-09-01'))
      const result = await within(dialog).findByRole('status')
      expect(result).toHaveTextContent('Salaries created: 1')
      expect(result).toHaveTextContent('Total added: 100.000 BD')
      expect(result).toHaveTextContent('Already had a salary this month: 1')
      // the page behind refreshed its list and totals
      await waitFor(() => expect(vi.mocked(api.listExpenses).mock.calls.length).toBeGreaterThan(1))

      await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('says so when running it again adds nothing', async () => {
      vi.mocked(api.generateMonthlySalaries).mockResolvedValue({
        created: 0,
        skipped: 2,
        totalFils: 0,
      })
      const dialog = await openDialog()
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Generate' }))
      const result = await within(dialog).findByRole('status')
      expect(result).toHaveTextContent('Every salary for this month already exists')
      expect(result).toHaveTextContent('Already had a salary this month: 2')
      expect(result).not.toHaveTextContent('Total added')
    })

    it('points to the Coaches page when nobody has a salary set', async () => {
      vi.mocked(coachesApi.listCoaches).mockResolvedValue([
        { ...khalid, monthly_salary_fils: 0 },
        retired,
      ])
      const dialog = await openDialog()
      expect(
        await within(dialog).findByText(/No active coach has a monthly salary yet/),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByRole('link', { name: 'Set salaries on the Coaches page' }),
      ).toHaveAttribute('href', '/admin/coaches')
      expect(within(dialog).getByRole('button', { name: 'Generate' })).toBeDisabled()
    })

    it('shows a translated message when the run fails', async () => {
      vi.mocked(api.generateMonthlySalaries).mockRejectedValue(new Error('ajyal:invalid_period'))
      const dialog = await openDialog()
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Generate' }))
      expect(await screen.findByText("That month can't be used.")).toBeInTheDocument()
    })
  })

  it('renders in Arabic with Arabic labels and Latin digits', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'المصروفات' })).toBeInTheDocument()
    expect((await screen.findAllByText('إيجار الملعب')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('150.000 د.ب').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'الشهر السابق' })).toBeInTheDocument()
  })
})
