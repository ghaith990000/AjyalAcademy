import { describe, expect, it } from 'vitest'
import { applicationFilePath, isImagePath, MAX_FILE_BYTES, playerFilePath, rejectionOf } from './storage'

function file(name: string, type: string, size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('rejectionOf', () => {
  it('accepts an image within the size and type list', () => {
    expect(rejectionOf(file('a.jpg', 'image/jpeg'))).toBeNull()
  })

  it('accepts a PDF for the CPR document list', () => {
    expect(rejectionOf(file('a.pdf', 'application/pdf'))).toBeNull()
  })

  it('refuses a type outside the given list (a PDF for an avatar-only list)', () => {
    expect(rejectionOf(file('a.pdf', 'application/pdf'), ['image/jpeg'])).toBe('badType')
  })

  it('refuses a file over the limit', () => {
    const big = file('a.jpg', 'image/jpeg', MAX_FILE_BYTES + 1)
    expect(rejectionOf(big)).toBe('tooLarge')
  })

  it('accepts a file exactly at the limit', () => {
    const exact = file('a.jpg', 'image/jpeg', MAX_FILE_BYTES)
    expect(rejectionOf(exact)).toBeNull()
  })
})

describe('applicationFilePath', () => {
  it('is scoped to the submission and child, with the right extension', () => {
    const path = applicationFilePath('11111111-1111-1111-1111-111111111111', 2, file('a.png', 'image/png'))
    expect(path).toMatch(
      /^applications\/11111111-1111-1111-1111-111111111111\/2-[0-9a-f-]{36}\.png$/,
    )
  })

  it('falls back to a generic extension for an unknown type', () => {
    const path = applicationFilePath('s1', 1, file('a', 'application/octet-stream'))
    expect(path).toMatch(/^applications\/s1\/1-[0-9a-f-]{36}\.bin$/)
  })
})

describe('playerFilePath', () => {
  it('is scoped to the player and the kind', () => {
    const cpr = playerFilePath('p1', 'cpr', file('a.pdf', 'application/pdf'))
    expect(cpr).toMatch(/^players\/p1\/cpr-[0-9a-f-]{36}\.pdf$/)

    const avatar = playerFilePath('p1', 'avatar', file('a.webp', 'image/webp'))
    expect(avatar).toMatch(/^players\/p1\/avatar-[0-9a-f-]{36}\.webp$/)
  })
})

describe('isImagePath', () => {
  it('recognises image extensions, case-insensitively', () => {
    expect(isImagePath('players/p1/cpr-x.jpg')).toBe(true)
    expect(isImagePath('players/p1/cpr-x.JPEG')).toBe(true)
    expect(isImagePath('players/p1/cpr-x.png')).toBe(true)
    expect(isImagePath('players/p1/cpr-x.webp')).toBe(true)
  })

  it('says no for a PDF', () => {
    expect(isImagePath('players/p1/cpr-x.pdf')).toBe(false)
  })
})
