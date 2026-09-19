import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { fakeAuth } from '@/test/auth'
import LoginPage from './pages/LoginPage'
import { AuthContext, type SignInResult } from './auth-context'

function setup(signIn = vi.fn<() => Promise<SignInResult>>().mockResolvedValue({ ok: true })) {
  render(
    <AuthContext.Provider value={fakeAuth(null, { signIn })}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return signIn
}

describe('LoginPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('asks for both fields before signing in', async () => {
    const signIn = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('rejects a malformed email', async () => {
    const signIn = setup()
    await userEvent.type(screen.getByLabelText(/Email/), 'not-an-email')
    await userEvent.type(screen.getByLabelText(/Password/), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signs in with the trimmed email and the password as typed', async () => {
    const signIn = setup()
    await userEvent.type(screen.getByLabelText(/Email/), '  coach@example.com ')
    await userEvent.type(screen.getByLabelText(/Password/), ' pass word ')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(signIn).toHaveBeenCalledWith('coach@example.com', ' pass word ')
  })

  it.each([
    ['invalidCredentials', 'Incorrect email or password.'],
    ['inactive', 'This account is inactive. Please contact the academy administrator.'],
    ['network', "Can't reach the server. Check your connection and try again."],
  ] as const)('shows a translated error for %s', async (error, text) => {
    setup(vi.fn().mockResolvedValue({ ok: false, error }))
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co')
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
  })

  it('shows the error in Arabic when the app language is Arabic', async () => {
    await i18n.changeLanguage('ar')
    setup(vi.fn().mockResolvedValue({ ok: false, error: 'invalidCredentials' }))
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'a@b.co')
    await userEvent.type(screen.getByLabelText(/^كلمة المرور/), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    )
  })
})
