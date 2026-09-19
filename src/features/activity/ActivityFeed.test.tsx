import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeActivity } from '@/test/activity'
import * as api from './api'
import { ActivityFeed } from './ActivityFeed'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listActivity: vi.fn(),
}))

const added = fakeActivity(
  'player.created',
  { player_name: 'Yousef', coach_name: 'Khalid' },
  { id: 'a1' },
)
const removed = fakeActivity('player.removed', { player_name: 'Ali' }, { id: 'a2' })
const older = fakeActivity(
  'payment.recorded',
  { player_names: ['Omar'], amount_fils: 20_000, balance_fils: 0 },
  { id: 'a3' },
)

function renderFeed(props: Partial<Parameters<typeof ActivityFeed>[0]> = {}) {
  return render(
    <Providers>
      <ActivityFeed role="admin" {...props} />
    </Providers>,
  )
}

describe('ActivityFeed', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listActivity).mockResolvedValue({ rows: [added, removed], next: null })
  })

  it('lists the entries newest first as sentences', async () => {
    renderFeed()
    expect(await screen.findByRole('heading', { name: 'Recent activity' })).toBeInTheDocument()
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Demo Admin added the player Yousef to the team of Khalid')
    expect(items[1]).toHaveTextContent('Demo Admin removed the player Ali')
    expect(api.listActivity).toHaveBeenCalledWith('all', null)
  })

  it('shows the live badge only while the live connection is up', async () => {
    const { rerender } = renderFeed({ live: true })
    expect(await screen.findByText('Live')).toBeInTheDocument()
    rerender(
      <Providers>
        <ActivityFeed role="admin" live={false} />
      </Providers>,
    )
    expect(screen.queryByText('Live')).not.toBeInTheDocument()
  })

  it('gives an admin a chip for every kind and a coach only the kinds a coach can do', async () => {
    const { unmount } = renderFeed({ role: 'admin' })
    const admin = await screen.findByRole('group', { name: 'Show' })
    expect(
      within(admin)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['All', 'Players', 'Subscriptions', 'Payments', 'Sessions', 'Expenses', 'Other'])
    unmount()

    renderFeed({ role: 'coach' })
    expect(await screen.findByRole('heading', { name: 'My recent activity' })).toBeInTheDocument()
    const coach = screen.getByRole('group', { name: 'Show' })
    expect(
      within(coach)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['All', 'Players', 'Subscriptions', 'Payments', 'Sessions'])
  })

  it('filters by kind', async () => {
    renderFeed()
    await screen.findAllByRole('listitem')
    await userEvent.click(screen.getByRole('button', { name: 'Payments' }))
    expect(screen.getByRole('button', { name: 'Payments' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(api.listActivity).toHaveBeenLastCalledWith('payment', null))
  })

  it('offers a way back when a filter has nothing', async () => {
    vi.mocked(api.listActivity).mockImplementation(async (filter) =>
      filter === 'all' ? { rows: [added], next: null } : { rows: [], next: null },
    )
    renderFeed()
    await screen.findAllByRole('listitem')
    await userEvent.click(screen.getByRole('button', { name: 'Expenses' }))
    expect(await screen.findByText('Nothing of this kind yet')).toBeInTheDocument()
    const groups = screen.getAllByRole('button', { name: 'All' })
    await userEvent.click(groups.at(-1)!)
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
  })

  it('loads the next page from where the last one ended', async () => {
    vi.mocked(api.listActivity)
      .mockResolvedValueOnce({
        rows: [added, removed],
        next: { createdAt: removed.created_at, id: removed.id },
      })
      .mockResolvedValueOnce({ rows: [older], next: null })
    renderFeed()
    await screen.findAllByRole('listitem')
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findAllByRole('listitem')).toHaveLength(3)
    expect(api.listActivity).toHaveBeenLastCalledWith('all', {
      createdAt: removed.created_at,
      id: removed.id,
    })
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('has an empty state, and a retry state', async () => {
    vi.mocked(api.listActivity).mockResolvedValue({ rows: [], next: null })
    renderFeed()
    expect(await screen.findByText('Activity will appear here')).toBeInTheDocument()

    document.body.innerHTML = ''
    vi.mocked(api.listActivity).mockRejectedValueOnce(new Error('boom'))
    renderFeed()
    expect(await screen.findByText("Couldn't load the activity")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Activity will appear here')).toBeInTheDocument()
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderFeed({ live: true })
    expect(await screen.findByRole('heading', { name: 'آخر النشاطات' })).toBeInTheDocument()
    expect(await screen.findByText(/أُزيل اللاعب/)).toBeInTheDocument()
    expect(screen.getByText('مباشر')).toBeInTheDocument()
  })
})
