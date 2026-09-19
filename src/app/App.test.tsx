import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import App from './App'

describe('App shell', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar')
  })

  it('renders Arabic (RTL) by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'أكاديمية أجيال' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('switches to English (LTR)', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Ajyal Academy' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('ltr')
  })
})
