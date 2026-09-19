import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { PriceBreakdown } from './PriceBreakdown'

describe('PriceBreakdown markup', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('keeps every row a direct child of the definition list (a wrapper div breaks it for screen readers)', () => {
    const { container } = render(
      <PriceBreakdown
        planPriceFils={20_000}
        tshirtTotalFils={5_000}
        transportTotalFils={0}
        discountFils={2_500}
        totalFils={22_500}
        paidFils={10_000}
        balanceFils={12_500}
      />,
    )
    const list = container.querySelector('dl')!
    for (const child of Array.from(list.children)) {
      expect(child.tagName).toBe('DIV')
      expect([...child.children].map((c) => c.tagName)).toEqual(['DT', 'DD'])
    }
    expect(list.children).toHaveLength(7) // plan, T-shirt, subtotal, discount, total, paid, balance
  })
})
