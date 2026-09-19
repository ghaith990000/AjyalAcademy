import { describe, expect, it } from 'vitest'
import { formatBDAmount, formatBHD, fromBD, parseBD, toBD } from './money'

describe('money', () => {
  it('converts BD to integer fils without float drift', () => {
    expect(fromBD(20)).toBe(20000)
    expect(fromBD('12.5')).toBe(12500)
    expect(fromBD(1.005)).toBe(1005)
    expect(fromBD(0.1 + 0.2)).toBe(300)
  })

  it('rejects non-numeric input', () => {
    expect(() => fromBD('abc')).toThrow()
  })

  it('converts fils back to BD', () => {
    expect(toBD(35000)).toBe(35)
    expect(toBD(1500)).toBe(1.5)
  })

  it('formats with 3 decimals and the language currency label', () => {
    expect(formatBDAmount(20000)).toBe('20.000')
    expect(formatBDAmount(1234567)).toBe('1,234.567')
    expect(formatBHD(60000, 'en')).toBe('60.000 BD')
    expect(formatBHD(60000, 'ar')).toBe('60.000 د.ب')
  })
})

describe('parseBD', () => {
  it('parses typed amounts into integer fils', () => {
    expect(parseBD('20')).toBe(20000)
    expect(parseBD('12.5')).toBe(12500)
    expect(parseBD('12,500')).toBe(12500)
    expect(parseBD(' 0.005 ')).toBe(5)
    expect(parseBD('0')).toBe(0)
    expect(parseBD('312.505')).toBe(312505)
  })

  it('returns null for anything that is not a plain BD amount', () => {
    for (const bad of ['', 'abc', '-5', '+5', '1.2345', '1..2', '1,000.500', '1e3', '.5', '5.']) {
      expect(parseBD(bad), bad).toBeNull()
    }
  })
})
