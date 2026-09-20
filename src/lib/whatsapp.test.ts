import { describe, expect, it } from 'vitest'
import { whatsappNumber, whatsappUrl } from './whatsapp'

describe('whatsappNumber', () => {
  it.each([
    ['39001234', '97339001234'], // a local number gets Bahrain's country code
    ['3900 1234', '97339001234'],
    ['+973 3900 1234', '97339001234'],
    ['00973 3900 1234', '97339001234'],
    ['97339001234', '97339001234'],
    ['+44 7700 900123', '447700900123'], // another country's number is kept as it is
    ['(973) 3900-1234', '97339001234'],
  ])('%s → %s', (input, expected) => {
    expect(whatsappNumber(input)).toBe(expected)
  })

  it.each(['', '   ', '1234', 'abc', '3900 12a4', '+', '1234567890123456'])(
    'refuses %j',
    (input) => {
      expect(whatsappNumber(input)).toBeNull()
    },
  )
})

describe('whatsappUrl', () => {
  it('carries the number and the encoded message', () => {
    expect(whatsappUrl('39001234', 'Hello Ali & Sara?')).toBe(
      'https://wa.me/97339001234?text=Hello%20Ali%20%26%20Sara%3F',
    )
  })

  it('encodes Arabic text', () => {
    const url = whatsappUrl('39001234', 'مرحباً')
    expect(url).toBe(`https://wa.me/97339001234?text=${encodeURIComponent('مرحباً')}`)
    expect(new URL(url ?? '').searchParams.get('text')).toBe('مرحباً')
  })

  it('is null for a number that cannot be used', () => {
    expect(whatsappUrl('12', 'Hi')).toBeNull()
  })
})
