import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeYear } from '@/test/finance'
import { RevenueChart } from './RevenueChart'

describe('RevenueChart', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('names the chart for assistive technology and explains the series in a legend', () => {
    render(
      <Providers>
        <RevenueChart
          rows={fakeYear({ 10: { collectedFils: 540_000, expensesFils: 210_000 } })}
          year={2026}
        />
      </Providers>,
    )
    expect(
      screen.getByRole('img', {
        name: /Chart of the fees collected, the expenses and the profit for each month of 2026/,
      }),
    ).toBeInTheDocument()
    for (const label of ['Collected', 'Expenses', 'Profit']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Months, January to December (left to right)')).toBeInTheDocument()
  })

  it('keeps the time axis left-to-right in Arabic too', async () => {
    await i18n.changeLanguage('ar')
    render(
      <Providers>
        <RevenueChart rows={fakeYear()} year={2026} />
      </Providers>,
    )
    expect(screen.getByRole('img')).toHaveAttribute('dir', 'ltr')
  })
})
