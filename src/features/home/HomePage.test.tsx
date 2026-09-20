import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import * as activityApi from '@/features/activity/api'
import * as activityHooks from '@/features/activity/hooks'
import * as applicationsApi from '@/features/applications/api'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import * as reportsApi from '@/features/reports/api'
import * as sessionsApi from '@/features/sessions/api'
import i18n from '@/lib/i18n'
import { fakeActivity } from '@/test/activity'
import { fakeAuth } from '@/test/auth'
import { OCTOBER_SUMMARY } from '@/test/finance'
import { fakeSession } from '@/test/sessions'
import { fakeSubscription } from '@/test/subscriptions'
import * as api from './api'
import HomePage from './HomePage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  countPlayers: vi.fn(),
  countActiveSubscriptions: vi.fn(),
  listExpiringSubscriptions: vi.fn(),
}))
vi.mock('@/features/activity/api', async (importOriginal) => ({
  ...(await importOriginal<typeof activityApi>()),
  listActivity: vi.fn(),
}))
vi.mock('@/features/applications/api', async (importOriginal) => ({
  ...(await importOriginal<typeof applicationsApi>()),
  countPendingApplications: vi.fn(),
}))
vi.mock('@/features/activity/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof activityHooks>()),
  useActivityRealtime: vi.fn(),
}))
vi.mock('@/features/sessions/api', async (importOriginal) => ({
  ...(await importOriginal<typeof sessionsApi>()),
  listTodaySessions: vi.fn(),
}))
vi.mock('@/features/reports/api', async (importOriginal) => ({
  ...(await importOriginal<typeof reportsApi>()),
  getReportSummary: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

function renderHome(role: 'admin' | 'coach') {
  return render(
    <Providers>
      <AuthContext.Provider value={fakeAuth(role)}>
        <MemoryRouter>
          <HomePage role={role} />
        </MemoryRouter>
      </AuthContext.Provider>
    </Providers>,
  )
}

/** The card that has this heading. */
const card = async (name: string) =>
  (await screen.findByRole('heading', { name })).closest(
    'div[class*="rounded-card"]',
  ) as HTMLElement

/** A stat card by its label (a heading elsewhere on the page may use the same words, e.g. "Today's sessions"). */
const stat = (label: string) =>
  screen
    .getAllByText(label)
    .map((element) => element.closest('div[class*="rounded-card"]') as HTMLElement)
    .find((cardElement) => !cardElement.querySelector('h2'))!

describe('HomePage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 12)) // 19 October 2026, noon
    await i18n.changeLanguage('en')
    vi.mocked(activityHooks.useActivityRealtime).mockReturnValue(true)
    vi.mocked(api.countPlayers).mockResolvedValue(42)
    vi.mocked(api.countActiveSubscriptions).mockResolvedValue(17)
    vi.mocked(api.listExpiringSubscriptions).mockResolvedValue({ rows: [], total: 0 })
    vi.mocked(reportsApi.getReportSummary).mockResolvedValue(OCTOBER_SUMMARY)
    vi.mocked(sessionsApi.listTodaySessions).mockResolvedValue([])
    vi.mocked(activityApi.listActivity).mockResolvedValue({ rows: [], next: null })
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([])
    vi.mocked(applicationsApi.countPendingApplications).mockResolvedValue(0)
  })
  afterEach(() => vi.useRealTimers())

  describe('admin', () => {
    it('greets by first name with the date, and shows the four numbers', async () => {
      renderHome('admin')
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Welcome back, Demo' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Monday 19 October')).toBeInTheDocument()

      expect(await within(stat('Active players')).findByText('42')).toBeInTheDocument()
      expect(await within(stat('Active subscriptions')).findByText('17')).toBeInTheDocument()
      expect(
        await within(stat('Collected this month')).findByText('540.000 BD'),
      ).toBeInTheDocument()
      const profit = stat('Net profit this month')
      expect(await within(profit).findByText('330.000 BD')).toBeInTheDocument()
      expect(within(profit).getByText('Margin 61.11%')).toBeInTheDocument()
    })

    it("reads the month's money from the same report the Reports page uses", async () => {
      renderHome('admin')
      await screen.findByText('540.000 BD')
      expect(reportsApi.getReportSummary).toHaveBeenCalledWith(
        { from: '2026-10-01', to: '2026-10-31' },
        undefined,
      )
    })

    it('shows a loss in the danger colour and no margin when nothing was collected', async () => {
      vi.mocked(reportsApi.getReportSummary).mockResolvedValue({
        collectedFils: 0,
        expensesFils: 20_000,
        profitFils: -20_000,
        marginBps: null,
      })
      renderHome('admin')
      const profit = stat('Net profit this month')
      const value = await within(profit).findByText('-20.000')
      expect(value.closest('span[class*="text-danger"]')).not.toBeNull()
      expect(within(profit).getByText('Margin —')).toBeInTheDocument()
    })

    it('keeps the other numbers when one of them cannot be read', async () => {
      vi.mocked(api.countPlayers).mockRejectedValue(new Error('boom'))
      renderHome('admin')
      expect(await within(stat('Active subscriptions')).findByText('17')).toBeInTheDocument()
      await waitFor(() => expect(within(stat('Active players')).getByText('—')).toBeInTheDocument())
    })

    it("shows everyone's activity, with a live badge", async () => {
      vi.mocked(activityApi.listActivity).mockResolvedValue({
        rows: [fakeActivity('player.removed', { player_name: 'Ali' })],
        next: null,
      })
      renderHome('admin')
      const feed = await card('Recent activity')
      expect(await within(feed).findByText(/removed the player/)).toBeInTheDocument()
      expect(within(feed).getByText('Live')).toBeInTheDocument()
      expect(within(feed).getByRole('button', { name: 'Expenses' })).toBeInTheDocument()
    })

    it("names the coach on today's sessions and links to attendance", async () => {
      vi.mocked(sessionsApi.listTodaySessions).mockResolvedValue([
        fakeSession({
          id: 's-1',
          start_time: '16:00:00',
          end_time: '17:30:00',
          location: { name: 'Field 2' },
        }),
      ])
      renderHome('admin')
      const sessions = await card("Today's sessions")
      expect(await within(sessions).findByText('4:00 PM – 5:30 PM')).toBeInTheDocument()
      expect(within(sessions).getByText('Khalid Al Dosari')).toBeInTheDocument()
      expect(within(sessions).getByText('Field 2')).toBeInTheDocument()
      expect(within(sessions).getByText('Upcoming')).toBeInTheDocument()
      expect(within(sessions).getByRole('link', { name: 'Take attendance' })).toHaveAttribute(
        'href',
        '/admin/sessions/s-1/attendance',
      )
      expect(within(sessions).getByRole('link', { name: 'All sessions' })).toHaveAttribute(
        'href',
        '/admin/sessions',
      )
    })

    it('links quick actions inside the admin area', async () => {
      renderHome('admin')
      const nav = await screen.findByRole('navigation', { name: 'Quick actions' })
      expect(within(nav).getByRole('link', { name: 'New subscription' })).toHaveAttribute(
        'href',
        '/admin/subscriptions/new',
      )
    })
  })

  describe('registration requests (admin)', () => {
    it('points at the requests waiting for a decision', async () => {
      vi.mocked(applicationsApi.countPendingApplications).mockResolvedValue(3)
      renderHome('admin')
      const link = await screen.findByRole('link', { name: /Registration requests/ })
      expect(link).toHaveAttribute('href', '/admin/applications')
      expect(link).toHaveTextContent('Waiting for your decision: 3')
    })

    it('shows nothing when no request is waiting', async () => {
      renderHome('admin')
      await screen.findByRole('heading', { level: 1, name: 'Welcome back, Demo' })
      await waitFor(() => expect(applicationsApi.countPendingApplications).toHaveBeenCalled())
      expect(screen.queryByRole('link', { name: /Registration requests/ })).not.toBeInTheDocument()
    })
  })

  describe('coach', () => {
    it('shows their own two numbers and no money', async () => {
      vi.mocked(sessionsApi.listTodaySessions).mockResolvedValue([fakeSession(), fakeSession()])
      renderHome('coach')
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Welcome back, Khalid' }),
      ).toBeInTheDocument()
      expect(await within(stat('My players')).findByText('42')).toBeInTheDocument()
      expect(await within(stat("Today's sessions")).findByText('2')).toBeInTheDocument()

      expect(screen.queryByText('Collected this month')).not.toBeInTheDocument()
      expect(screen.queryByText('Net profit this month')).not.toBeInTheDocument()
      expect(screen.queryByText('Active subscriptions')).not.toBeInTheDocument()
      expect(reportsApi.getReportSummary).not.toHaveBeenCalled()
      expect(api.countActiveSubscriptions).not.toHaveBeenCalled()
      // registration requests are the admins' business
      expect(applicationsApi.countPendingApplications).not.toHaveBeenCalled()
    })

    it('has a one-tap "Take attendance" on each of their sessions, inside the coach area', async () => {
      vi.mocked(sessionsApi.listTodaySessions).mockResolvedValue([fakeSession({ id: 's-9' })])
      renderHome('coach')
      const sessions = await card("Today's sessions")
      expect(
        await within(sessions).findByRole('link', { name: 'Take attendance' }),
      ).toHaveAttribute('href', '/coach/sessions/s-9/attendance')
      // a coach only ever sees their own sessions, so the coach's name is not repeated
      expect(within(sessions).queryByText('Khalid Al Dosari')).not.toBeInTheDocument()
    })

    it('shows only their own kinds of activity', async () => {
      renderHome('coach')
      const feed = await card('My recent activity')
      expect(within(feed).queryByRole('button', { name: 'Expenses' })).not.toBeInTheDocument()
      expect(within(feed).queryByRole('button', { name: 'Other' })).not.toBeInTheDocument()
    })

    it('links quick actions inside the coach area', async () => {
      renderHome('coach')
      const nav = await screen.findByRole('navigation', { name: 'Quick actions' })
      expect(within(nav).getByRole('link', { name: 'New subscription' })).toHaveAttribute(
        'href',
        '/coach/subscriptions/new',
      )
    })
  })

  describe("today's sessions", () => {
    it('has an empty state with a link to all sessions', async () => {
      renderHome('admin')
      expect(await screen.findByText('No sessions today')).toBeInTheDocument()
    })

    it('has a retry state', async () => {
      vi.mocked(sessionsApi.listTodaySessions).mockRejectedValueOnce(new Error('boom'))
      renderHome('admin')
      const sessions = await card("Today's sessions")
      expect(
        await within(sessions).findByText("Couldn't load today's sessions."),
      ).toBeInTheDocument()
      await userEvent.click(within(sessions).getByRole('button', { name: 'Try again' }))
      expect(await within(sessions).findByText('No sessions today')).toBeInTheDocument()
    })
  })

  describe('expiring soon', () => {
    const rows = [
      fakeSubscription({
        id: 'e1',
        player_names: 'Ali Hassan',
        plan_code: 'solo',
        status: 'expiring_soon',
        end_date: '2026-10-20',
        balance_fils: 15_000,
      }),
      fakeSubscription({
        id: 'e2',
        player_names: 'Omar Hassan, Zayed Nasser',
        plan_code: 'duo',
        status: 'expiring_soon',
        end_date: '2026-10-19',
        balance_fils: 0,
      }),
      fakeSubscription({
        id: 'e3',
        player_names: 'Bader Khaled',
        plan_code: 'solo',
        status: 'expiring_soon',
        end_date: '2026-10-24',
        balance_fils: 0,
      }),
    ]

    it('lists them soonest first with when they end, and flags a balance still owed', async () => {
      vi.mocked(api.listExpiringSubscriptions).mockResolvedValue({ rows, total: 3 })
      renderHome('admin')
      const expiring = await card('Expiring soon')
      const items = await within(expiring).findAllByRole('listitem')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('Ali Hassan')
      expect(items[0]).toHaveTextContent('Ends tomorrow')
      expect(items[0]).toHaveTextContent('Unpaid: 15.000 BD')
      expect(items[1]).toHaveTextContent('Omar Hassan, Zayed Nasser')
      expect(items[1]).toHaveTextContent('Duo')
      expect(items[1]).toHaveTextContent('Ends today')
      expect(items[1]).not.toHaveTextContent('Unpaid')
      expect(items[2]).toHaveTextContent('Ends in 5 days')
      expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/admin/subscriptions/e1')
    })

    it('says how many more there are when the list is cut short', async () => {
      vi.mocked(api.listExpiringSubscriptions).mockResolvedValue({ rows, total: 8 })
      renderHome('admin')
      expect(await screen.findByText('Showing 3 of 8')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'All subscriptions' })).toHaveAttribute(
        'href',
        '/admin/subscriptions',
      )
    })

    it('has an empty state and a retry state', async () => {
      renderHome('admin')
      expect(await screen.findByText('Nothing expiring soon')).toBeInTheDocument()

      document.body.innerHTML = ''
      vi.mocked(api.listExpiringSubscriptions).mockRejectedValueOnce(new Error('boom'))
      renderHome('admin')
      const expiring = await card('Expiring soon')
      expect(
        await within(expiring).findByText("Couldn't load the subscriptions."),
      ).toBeInTheDocument()
      await userEvent.click(within(expiring).getByRole('button', { name: 'Try again' }))
      expect(await within(expiring).findByText('Nothing expiring soon')).toBeInTheDocument()
    })

    it('shows the coach the same list inside their own area', async () => {
      vi.mocked(api.listExpiringSubscriptions).mockResolvedValue({ rows: [rows[0]!], total: 1 })
      renderHome('coach')
      const expiring = await card('Expiring soon')
      expect(await within(expiring).findByRole('link', { name: /Ali Hassan/ })).toHaveAttribute(
        'href',
        '/coach/subscriptions/e1',
      )
    })
  })

  describe('quick actions', () => {
    it('opens the add-player form in place', async () => {
      renderHome('admin')
      await userEvent.click(await screen.findByRole('button', { name: 'Add player' }))
      expect(await screen.findByRole('dialog', { name: 'Add player' })).toBeInTheDocument()
    })

    it('opens the schedule form in place', async () => {
      renderHome('coach')
      await userEvent.click(await screen.findByRole('button', { name: 'Schedule session' }))
      expect(await screen.findByRole('dialog', { name: 'Schedule a session' })).toBeInTheDocument()
    })
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderHome('admin')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'أهلاً بعودتك، Demo' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('540.000 د.ب')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'إجراءات سريعة' })).toBeInTheDocument()
    expect(await screen.findByText('لا توجد حصص اليوم')).toBeInTheDocument()
  })
})
