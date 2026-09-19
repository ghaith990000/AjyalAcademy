import { describe, expect, it } from 'vitest'
import {
  formatDiscountValue,
  formatPercent,
  parsePercentToBps,
  percentInputValue,
} from './discounts'

describe('parsePercentToBps', () => {
  it('turns typed percentages into basis points', () => {
    expect(parsePercentToBps('10')).toBe(1000)
    expect(parsePercentToBps('12.5')).toBe(1250)
    expect(parsePercentToBps('12,25')).toBe(1225)
    expect(parsePercentToBps(' 100 ')).toBe(10000)
    expect(parsePercentToBps('0.01')).toBe(1)
  })

  it('rejects zero, above 100%, and anything that is not a plain percentage', () => {
    for (const bad of ['', '0', '0.00', '100.01', '101', '-5', '5%', 'abc', '1.234', '.5']) {
      expect(parsePercentToBps(bad), bad).toBeNull()
    }
  })
})

describe('percent formatting', () => {
  it('shows only the decimals that matter', () => {
    expect(formatPercent(1000)).toBe('10%')
    expect(formatPercent(1250)).toBe('12.5%')
    expect(formatPercent(1225)).toBe('12.25%')
    expect(formatPercent(10000)).toBe('100%')
  })

  it('round-trips through the edit field', () => {
    for (const bps of [1, 500, 1000, 1250, 1225, 10000]) {
      expect(parsePercentToBps(percentInputValue(bps))).toBe(bps)
    }
  })
})

describe('formatDiscountValue', () => {
  it('formats percent and fixed discounts per language', () => {
    expect(formatDiscountValue('percent', 1000, 'en')).toBe('10%')
    expect(formatDiscountValue('fixed', 5000, 'en')).toBe('5.000 BD')
    expect(formatDiscountValue('fixed', 5000, 'ar')).toBe('5.000 د.ب')
  })
})
