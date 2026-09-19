import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { AppErrorBoundary } from './AppErrorBoundary'
import { isChunkLoadError } from './chunkError'
import { ErrorScreen } from './ErrorScreen'
import { RouteErrorPage } from './RouteErrorPage'

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/Page-1.js', // Chrome, Edge
    'error loading dynamically imported module', // Firefox
    'Importing a module script failed.', // Safari
    'Loading chunk 12 failed.',
    'TypeError: Failed to fetch',
  ])('recognises "%s"', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true)
  })

  it('leaves ordinary errors alone', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'x')"))).toBe(
      false,
    )
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('ErrorScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('says something plain and offers a way out', () => {
    render(<ErrorScreen error={new Error('boom')} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument()
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument() // raw error text is never shown
  })

  it('explains a page that could not be downloaded (usually: the app was just updated)', () => {
    render(<ErrorScreen error={new Error('Failed to fetch dynamically imported module')} />)
    expect(screen.getByText("This page couldn't be loaded")).toBeInTheDocument()
    expect(screen.getByText(/may have just been updated/)).toBeInTheDocument()
  })

  it('reloads the page on request', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload, pathname: '/admin/players' })
    render(<ErrorScreen error={new Error('x')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('goes back to the right home for the area the person was in', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...location, assign, pathname: '/coach/sessions' })
    render(<ErrorScreen error={new Error('x')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(assign).toHaveBeenCalledWith('/coach')
    vi.unstubAllGlobals()
  })

  it('speaks Arabic too', async () => {
    await i18n.changeLanguage('ar')
    render(<ErrorScreen error={new Error('x')} />)
    expect(screen.getByText('حدث خطأ ما')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إعادة التحميل' })).toBeInTheDocument()
  })
})

describe('AppErrorBoundary', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  function Boom(): never {
    throw new Error('render failed')
  }

  it('shows the error screen instead of a white page when rendering throws', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('leaves a healthy app alone', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})

describe('RouteErrorPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('catches a page that throws and keeps the surrounding layout', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <p>the shell</p>,
          errorElement: <RouteErrorPage inline />,
          children: [
            {
              path: 'bad',
              lazy: async () => {
                throw new Error('Failed to fetch dynamically imported module')
              },
            },
          ],
        },
      ],
      { initialEntries: ['/bad'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText("This page couldn't be loaded")).toBeInTheDocument()
  })
})
