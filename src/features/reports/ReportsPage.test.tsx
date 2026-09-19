import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeYear, OCTOBER_CATEGORIES, OCTOBER_SUMMARY } from '@/test/finance'
import * as api from './api'
import * as exportCsv from './exportCsv'
import ReportsPage from './ReportsPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getReportSummary: vi.fn(),
  getRevenueByMonth: vi.fn(),
  getExpensesByCategory: vi.fn(),
  listPaymentsForExport: vi.fn(),
  listExpensesForExport: vi.fn(),
}))
vi.mock('./exportCsv', async (importOriginal) => ({
  ...(await importOriginal<typeof exportCsv>()),
  downloadCsv: vi.fn(),
}))
// Recharts measures its container, which jsdom cannot do; the chart has its own smoke test.
vi.mock('./RevenueChart', () => ({
  RevenueChart: ({ year, rows }: { year: number; rows: unknown[] }) => (
    <div data-testid="chart">
      chart {year} ({rows.length} months)
    </div>
  ),
}))

/** October 2026 = the worked example (540 collected, 210 spent); the rest of the year is empty. */
const OCTOBER_YEAR = fakeYear({
  10: { collectedFils: 540_000, expensesFils: 210_000, profitFils: 330_000 },
})

function renderPage() {
  return render(
    <Providers>
      <ReportsPage />
    </Providers>,
  )
}

/** The summary card with this label (the same words also head table columns and chart legends). */
async function kpi(label: string) {
  const summary = await screen.findByRole('region', { name: i18n.t('reports:kpi.label') })
  return (await within(summary).findByText(label)).closest('div')!
}

describe('ReportsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 12)) // opens on October 2026
    await i18n.changeLanguage('en')
    vi.mocked(api.getReportSummary).mockResolvedValue(OCTOBER_SUMMARY)
    vi.mocked(api.getRevenueByMonth).mockResolvedValue(OCTOBER_YEAR)
    vi.mocked(api.getExpensesByCategory).mockResolvedValue(OCTOBER_CATEGORIES)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the worked example: collected 540, expenses 210, profit 330, margin 61.11%', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(await screen.findByText('540.000 BD')).toBeInTheDocument()
    expect(within(await kpi('Collected')).getByText('540.000 BD')).toBeInTheDocument()
    expect(within(await kpi('Expenses')).getByText('210.000 BD')).toBeInTheDocument()
    expect(within(await kpi('Profit')).getByText('330.000 BD')).toBeInTheDocument()
    expect(within(await kpi('Margin')).getByText('61.11%')).toBeInTheDocument()
    expect(api.getReportSummary).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
    expect(api.getRevenueByMonth).toHaveBeenCalledWith(2026)
    expect(api.getExpensesByCategory).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('shows a loss in red with a minus sign, and no margin when nothing was collected', async () => {
    vi.mocked(api.getReportSummary).mockResolvedValue({
      collectedFils: 0,
      expensesFils: 20_000,
      profitFils: -20_000,
      marginBps: null,
    })
    renderPage()
    const profit = within(await kpi('Profit')).getByText('-20.000')
    expect(profit.closest('p')).toHaveClass('text-danger')
    // margin is a dash, and a dash is not a negative number, so it stays neutral
    const margin = within(await kpi('Margin')).getByText('—')
    expect(margin.closest('p')).not.toHaveClass('text-danger')
  })

  it('shows a negative margin in red', async () => {
    vi.mocked(api.getReportSummary).mockResolvedValue({
      collectedFils: 10_000,
      expensesFils: 25_000,
      profitFils: -15_000,
      marginBps: -15_000,
    })
    renderPage()
    const margin = await within(await kpi('Margin')).findByText('-150.00%')
    expect(margin.closest('p')).toHaveClass('text-danger')
  })

  it('breaks the expenses down by category with shares', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'Expenses by category' })).closest(
      'div',
    )!
    expect(await within(card).findByText('Coach salary')).toBeInTheDocument()
    expect(within(card).getByText('150.000 BD')).toBeInTheDocument()
    expect(within(card).getByText('71%')).toBeInTheDocument()
    expect(within(card).getByText('Field rent')).toBeInTheDocument()
    expect(within(card).getByText('24%')).toBeInTheDocument()
    expect(within(card).getByText('Transportation')).toBeInTheDocument()
    expect(within(card).getByText('5%')).toBeInTheDocument()
  })

  it('says so when the period has no expenses', async () => {
    vi.mocked(api.getExpensesByCategory).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No expenses in this period.')).toBeInTheDocument()
  })

  it("lists the year's 12 months with a total row and highlights the selected month", async () => {
    renderPage()
    expect(await screen.findByTestId('chart')).toHaveTextContent('chart 2026 (12 months)')
    const table = await screen.findByRole('table', {
      name: 'Collected, expenses and profit for each month',
    })
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 12 + 1) // header, months, total
    const october = within(table).getByRole('row', { name: /October/ })
    expect(october).toHaveAttribute('aria-current', 'true')
    expect(within(october).getByText('540.000')).toBeInTheDocument()
    expect(within(october).getByText('330.000')).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /January/ })).not.toHaveAttribute('aria-current')
    const total = within(table).getByRole('row', { name: /Year/ })
    expect(within(total).getByText('540.000')).toBeInTheDocument()
    expect(within(total).getByText('210.000')).toBeInTheDocument()
    expect(within(total).getByText('330.000')).toBeInTheDocument()
  })

  it('shows a loss month signed and in red in the table', async () => {
    vi.mocked(api.getRevenueByMonth).mockResolvedValue(
      fakeYear({
        8: { expensesFils: 20_000 },
        10: { collectedFils: 540_000, expensesFils: 210_000 },
      }),
    )
    renderPage()
    const table = await screen.findByRole('table')
    const august = within(table).getByRole('row', { name: /August/ })
    const loss = within(august).getByText('-20.000')
    expect(loss.closest('td')).toHaveClass('text-danger')
  })

  it('shows an empty state instead of a chart when the year has nothing', async () => {
    vi.mocked(api.getRevenueByMonth).mockResolvedValue(fakeYear())
    renderPage()
    expect(await screen.findByText('Nothing recorded in 2026')).toBeInTheDocument()
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
  })

  it('steps back a month, and stops at the current one', async () => {
    renderPage()
    await screen.findByText('540.000 BD')
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(await screen.findByText('September 2026')).toBeInTheDocument()
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenLastCalledWith({
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    )
    expect(api.getRevenueByMonth).toHaveBeenLastCalledWith(2026)
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })

  it('crosses the year boundary going back from January', async () => {
    vi.setSystemTime(new Date(2026, 0, 10, 12))
    renderPage()
    await screen.findByText('January 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('December 2025')).toBeInTheDocument()
    await waitFor(() => expect(api.getRevenueByMonth).toHaveBeenLastCalledWith(2025))
    expect(api.getReportSummary).toHaveBeenLastCalledWith({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('switches to the year view: the whole year, stepping by year', async () => {
    renderPage()
    await screen.findByText('540.000 BD')

    await userEvent.click(screen.getByRole('tab', { name: 'Year' }))

    expect(await screen.findByText('2026', { selector: 'bdi' })).toBeInTheDocument()
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenLastCalledWith({
        from: '2026-01-01',
        to: '2026-12-31',
      }),
    )
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled()
    const table = await screen.findByRole('table')
    expect(within(table).queryByRole('row', { selected: true })).not.toBeInTheDocument()
    expect(table.querySelector('[aria-current]')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Previous year' }))
    await waitFor(() => expect(api.getRevenueByMonth).toHaveBeenLastCalledWith(2025))
    expect(api.getReportSummary).toHaveBeenLastCalledWith({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('has a retry state', async () => {
    vi.mocked(api.getReportSummary).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load the report")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('540.000 BD')).toBeInTheDocument()
  })

  describe('CSV export', () => {
    it('downloads every payment of the period as a UTF-8 file named after it', async () => {
      vi.mocked(api.listPaymentsForExport).mockResolvedValue([
        {
          paid_at: '2026-10-01',
          amount_fils: 200_000,
          method: 'cash',
          note: null,
          received_by: { full_name: 'Demo Admin' },
          subscription: {
            plan: { code: 'solo' },
            subscription_players: [{ player: { full_name: 'محمد علي' } }],
          },
        },
      ])
      renderPage()
      await screen.findByText('540.000 BD')
      await userEvent.click(screen.getByRole('button', { name: 'Payments (CSV)' }))

      await waitFor(() => expect(exportCsv.downloadCsv).toHaveBeenCalledOnce())
      expect(api.listPaymentsForExport).toHaveBeenCalledWith({
        from: '2026-10-01',
        to: '2026-10-31',
      })
      const [fileName, content] = vi.mocked(exportCsv.downloadCsv).mock.calls[0]!
      expect(fileName).toBe('ajyal-payments-2026-10.csv')
      expect(content.charCodeAt(0)).toBe(0xfeff)
      expect(content).toContain('Date,Amount (BD),Method,Players,Plan,Note,Received by')
      expect(content).toContain('2026-10-01,200.000,Cash,محمد علي,Solo,,Demo Admin')
      expect(await screen.findByText('File downloaded')).toBeInTheDocument()
    })

    it('exports the whole year in the year view', async () => {
      vi.mocked(api.listExpensesForExport).mockResolvedValue([
        {
          expense_date: '2026-03-01',
          category: 'coach_salary',
          amount_fils: 150_000,
          description: null,
          coach: { full_name: 'Khalid' },
        },
      ])
      renderPage()
      await screen.findByText('540.000 BD')
      await userEvent.click(screen.getByRole('tab', { name: 'Year' }))
      await userEvent.click(screen.getByRole('button', { name: 'Expenses (CSV)' }))

      await waitFor(() => expect(exportCsv.downloadCsv).toHaveBeenCalledOnce())
      expect(api.listExpensesForExport).toHaveBeenCalledWith({
        from: '2026-01-01',
        to: '2026-12-31',
      })
      const [fileName, content] = vi.mocked(exportCsv.downloadCsv).mock.calls[0]!
      expect(fileName).toBe('ajyal-expenses-2026.csv')
      expect(content).toContain('2026-03-01,Coach salary,150.000,Khalid,')
    })

    it('says so when the file could not be built', async () => {
      vi.mocked(api.listPaymentsForExport).mockRejectedValue(new Error('boom'))
      renderPage()
      await screen.findByText('540.000 BD')
      await userEvent.click(screen.getByRole('button', { name: 'Payments (CSV)' }))
      expect(await screen.findByText("Couldn't create the file")).toBeInTheDocument()
      expect(exportCsv.downloadCsv).not.toHaveBeenCalled()
    })
  })

  it('renders in Arabic with Latin digits, Arabic labels and the Arabic percent sign', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'التقارير' })).toBeInTheDocument()
    expect(await screen.findByText('540.000 د.ب')).toBeInTheDocument()
    expect(within(await kpi('الهامش')).getByText('61.11٪')).toBeInTheDocument()
    expect(screen.getByText('أكتوبر 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'الشهر السابق' })).toBeInTheDocument()
  })
})
