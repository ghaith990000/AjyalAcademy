import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import * as api from './api'
import { PlayerAttendanceCard } from './PlayerAttendanceCard'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listPlayerAttendance: vi.fn(),
  countPlayerPresent: vi.fn(),
}))

const record = (n: number, status: 'present' | 'absent'): api.PlayerAttendanceRow => ({
  session_id: `s${n}`,
  status,
  marked_at: '2026-09-19T15:00:00Z',
  session_date: `2026-09-${String(30 - n).padStart(2, '0')}`,
  start_time: '16:00:00',
  end_time: '17:30:00',
  location: null,
})

function renderCard() {
  render(
    <Providers>
      <PlayerAttendanceCard playerId="p1" />
    </Providers>,
  )
}

describe('PlayerAttendanceCard', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
  })

  it('shows the rate as a whole percent, the counts and each session with its status', async () => {
    vi.mocked(api.listPlayerAttendance).mockResolvedValue({
      rows: [record(1, 'present'), record(2, 'absent'), record(3, 'present')],
      total: 3,
    })
    vi.mocked(api.countPlayerPresent).mockResolvedValue(2)
    renderCard()
    expect(await screen.findByText('67%')).toBeInTheDocument() // 2 of 3 = 66.7 → 67
    expect(screen.getByText('Present at 2 of 3 sessions')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('29/09/2026')).toBeInTheDocument()
    expect(screen.getAllByText('Present')).toHaveLength(2)
    expect(screen.getAllByText('Absent')).toHaveLength(1)
    expect(screen.getAllByText('4:00 PM – 5:30 PM').length).toBe(3)
  })

  it('computes the rate over every session, not only the ones on screen, and pages the history', async () => {
    vi.mocked(api.listPlayerAttendance).mockImplementation(async (_id, page) =>
      page === 0
        ? { rows: [record(1, 'present')], total: 4 }
        : { rows: [record(2, 'absent')], total: 4 },
    )
    vi.mocked(api.countPlayerPresent).mockResolvedValue(3)
    renderCard()
    expect(await screen.findByText('75%')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(api.listPlayerAttendance).toHaveBeenLastCalledWith('p1', 1)
  })

  it('says so when nothing has been recorded', async () => {
    vi.mocked(api.listPlayerAttendance).mockResolvedValue({ rows: [], total: 0 })
    vi.mocked(api.countPlayerPresent).mockResolvedValue(0)
    renderCard()
    expect(await screen.findByText('No attendance recorded yet.')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('shows 0% for a player who was never present', async () => {
    vi.mocked(api.listPlayerAttendance).mockResolvedValue({ rows: [record(1, 'absent')], total: 1 })
    vi.mocked(api.countPlayerPresent).mockResolvedValue(0)
    renderCard()
    expect(await screen.findByText('0%')).toBeInTheDocument()
  })

  it('offers a retry when the history cannot be loaded', async () => {
    vi.mocked(api.listPlayerAttendance).mockRejectedValueOnce(new Error('boom'))
    vi.mocked(api.countPlayerPresent).mockResolvedValue(1)
    renderCard()
    expect(await screen.findByText("Couldn't load the attendance.")).toBeInTheDocument()
    vi.mocked(api.listPlayerAttendance).mockResolvedValue({
      rows: [record(1, 'present')],
      total: 1,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('100%')).toBeInTheDocument()
  })
})
