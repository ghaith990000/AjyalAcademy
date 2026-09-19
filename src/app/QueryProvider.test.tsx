import { useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import * as endSessionModule from '@/features/auth/endSession'
import i18n from '@/lib/i18n'
import { QueryProvider } from './QueryProvider'

vi.mock('@/features/auth/endSession', () => ({ endSession: vi.fn() }))

function Failing({ error, silent }: { error: unknown; silent: boolean }) {
  useQuery({
    queryKey: ['x'],
    queryFn: () => Promise.reject(error),
    retry: false,
    meta: { silent },
  })
  return null
}

function renderWith(error: unknown, silent = false) {
  return render(
    <ToastProvider>
      <QueryProvider>
        <Failing error={error} silent={silent} />
      </QueryProvider>
    </ToastProvider>,
  )
}

describe('QueryProvider error handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
  })

  it('toasts a plain failure in words', async () => {
    renderWith(new Error('boom'))
    expect(
      (await screen.findAllByText('An unexpected error occurred. Please try again.')).length,
    ).toBeGreaterThan(0)
    expect(endSessionModule.endSession).not.toHaveBeenCalled()
  })

  it('ends the session, without a toast, when the server rejects the login itself', async () => {
    renderWith({ status: 401, code: 'PGRST301', message: 'JWT expired' })
    await waitFor(() => expect(endSessionModule.endSession).toHaveBeenCalledOnce())
    expect(screen.queryByText(/Your session has expired/)).not.toBeInTheDocument()
  })

  it('ends the session even when the screen shows its own errors (silent queries)', async () => {
    renderWith({ status: 401, code: 'PGRST301', message: 'JWT expired' }, true)
    await waitFor(() => expect(endSessionModule.endSession).toHaveBeenCalledOnce())
  })

  it('leaves an ordinary silent failure to its screen: no toast, no sign-out', async () => {
    renderWith(new Error('boom'), true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(endSessionModule.endSession).not.toHaveBeenCalled()
    expect(
      screen.queryByText('An unexpected error occurred. Please try again.'),
    ).not.toBeInTheDocument()
  })

  it('does not treat a permission error as a session problem', async () => {
    renderWith({ code: '42501', message: 'denied' })
    expect(
      (await screen.findAllByText("You don't have permission to do that.")).length,
    ).toBeGreaterThan(0)
    expect(endSessionModule.endSession).not.toHaveBeenCalled()
  })
})
