import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { InstallHint } from './InstallHint'
import { isIosDevice, isStandalone, rememberDismissed, wasDismissed } from './install'
import { OfflineBanner } from './OfflineBanner'
import { UpdatePrompt } from './UpdatePrompt'

const sw = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn(),
  onRegisteredSW: undefined as undefined | ((url: string, r?: { update: () => void }) => void),
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: { onRegisteredSW?: typeof sw.onRegisteredSW }) => {
    sw.onRegisteredSW = options?.onRegisteredSW
    return { needRefresh: [sw.needRefresh, vi.fn()], updateServiceWorker: sw.updateServiceWorker }
  },
}))

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  act(() => void window.dispatchEvent(new Event(online ? 'online' : 'offline')))
}

describe('OfflineBanner', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => setOnline(true))

  it('appears when the connection drops and goes when it returns', () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent("You're offline.")
    expect(screen.getByRole('status')).toHaveTextContent("changes can't be saved")

    setOnline(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is in Arabic too', async () => {
    await i18n.changeLanguage('ar')
    render(<OfflineBanner />)
    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent('لا يوجد اتصال بالإنترنت')
  })
})

describe('UpdatePrompt', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    sw.needRefresh = false
    await i18n.changeLanguage('en')
  })

  it('stays out of the way until a new version has been downloaded', () => {
    render(<UpdatePrompt />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers the update, and applies it only when asked', async () => {
    sw.needRefresh = true
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent('A new version of the app is ready.')
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('asks the server for a newer version every hour while the app stays open', () => {
    vi.useFakeTimers()
    render(<UpdatePrompt />)
    const update = vi.fn()
    sw.onRegisteredSW?.('/sw.js', { update })
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(update).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})

describe('install rules', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('recognises an iPhone, an iPad and an iPad that says it is a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(
      true,
    )
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5)).toBe(true)
  })

  it('does not take a desktop or an Android phone for iOS', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l', 5)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Windows NT 10.0)', 'Win32', 0)).toBe(false)
  })

  it('remembers a dismissal, and copes with blocked storage', () => {
    expect(wasDismissed()).toBe(false)
    rememberDismissed()
    expect(wasDismissed()).toBe(true)

    localStorage.clear()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(wasDismissed()).toBe(false)
    expect(() => rememberDismissed()).not.toThrow()
  })

  it('knows when the app is already running from the home screen', () => {
    expect(isStandalone()).toBe(false)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(isStandalone()).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('InstallHint', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const fireInstallPrompt = (prompt = vi.fn().mockResolvedValue(undefined)) => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
    act(() => void window.dispatchEvent(event))
    return { event, prompt }
  }

  it('is invisible where the app cannot be installed', () => {
    render(<InstallHint />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('offers an Install button once the browser says the app can be installed', async () => {
    render(<InstallHint />)
    const { event, prompt } = fireInstallPrompt()
    expect(event.defaultPrevented).toBe(true) // the browser's own bar is replaced by this card
    expect(screen.getByRole('region', { name: 'Install the app' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(prompt).toHaveBeenCalledOnce()
  })

  it('gives the Share-sheet steps on an iPhone, where there is nothing to press', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    )
    render(<InstallHint />)
    expect(screen.getByText(/tap the Share button/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('goes away when dismissed, and stays away next time', async () => {
    const { unmount } = render(<InstallHint />)
    fireInstallPrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(wasDismissed()).toBe(true)
    unmount()

    render(<InstallHint />)
    fireInstallPrompt()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('goes away once the app has been installed', () => {
    render(<InstallHint />)
    fireInstallPrompt()
    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('is not shown to someone already using the installed app', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(<InstallHint />)
    fireInstallPrompt()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
