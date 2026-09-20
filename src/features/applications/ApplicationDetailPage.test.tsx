import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import * as coachesApi from '@/features/coaches/api'
import i18n from '@/lib/i18n'
import { fakeApplication } from '@/test/applications'
import * as api from './api'
import ApplicationDetailPage from './ApplicationDetailPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getApplication: vi.fn(),
  acceptApplication: vi.fn(),
  rejectApplication: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const pending = fakeApplication({
  id: 'app-1',
  full_name: 'Noor Al Mahmood',
  guardian_name: 'Mona Al Mahmood',
  phone: '3900 1234',
  language: 'ar',
  location_id: 'loc-1',
  location_name: 'Al-Rifa',
  date_of_birth: '2014-03-12',
  cpr: '140312345',
})

function renderPage(id = 'app-1') {
  const router = createMemoryRouter(
    [
      { path: '/admin/applications', element: <p>list page</p> },
      { path: '/admin/applications/:id', element: <ApplicationDetailPage /> },
      { path: '/admin/players/:id', element: <p>player page</p> },
    ],
    { initialEntries: [`/admin/applications/${id}`] },
  )
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

const dialog = () => screen.findByRole('dialog')

describe('ApplicationDetailPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.getApplication).mockResolvedValue(pending)
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([
      {
        id: 'c1',
        full_name: 'Khalid Al Dosari',
        email: 'k@example.com',
        role: 'coach',
        phone: null,
        monthly_salary_fils: 0,
        active: true,
        preferred_language: 'ar',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c2',
        full_name: 'Retired Coach',
        email: 'r@example.com',
        role: 'coach',
        phone: null,
        monthly_salary_fils: 0,
        active: false,
        preferred_language: 'ar',
        created_at: '2026-01-01T00:00:00Z',
      },
    ])
  })

  describe('a request waiting for a decision', () => {
    it('shows the child, the parent and the two decisions', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Noor Al Mahmood' })).toBeInTheDocument()
      expect(screen.getByText('140312345')).toBeInTheDocument()
      expect(screen.getByText('Mona Al Mahmood')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '3900 1234' })).toHaveAttribute(
        'href',
        'tel:3900 1234',
      )
      expect(screen.getByText('Arabic')).toBeInTheDocument()
      expect(screen.getByText('Al-Rifa')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
      // nothing to tell the parent yet
      expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
    })

    it('warns about a CPR that already belongs to a player, with a link to that player', async () => {
      vi.mocked(api.getApplication).mockResolvedValue({
        ...pending,
        existing_player_id: 'p-old',
        existing_player_name: 'Noor Al Mahmood',
        same_cpr_pending: 1,
      })
      renderPage()
      expect(await screen.findByText('Check before accepting')).toBeInTheDocument()
      expect(screen.getByText('A player with this CPR already exists:')).toBeInTheDocument()
      expect(
        screen.getByText('Another request that is still waiting has the same CPR.'),
      ).toBeInTheDocument()
      const link = screen.getByRole('link', { name: 'Noor Al Mahmood' })
      expect(link).toHaveAttribute('href', '/admin/players/p-old')
    })

    it('shows a medical condition prominently', async () => {
      vi.mocked(api.getApplication).mockResolvedValue({
        ...pending,
        has_disease: true,
        disease_description: 'Asthma — carries an inhaler',
      })
      renderPage()
      expect(await screen.findByText('Asthma — carries an inhaler')).toBeInTheDocument()
      expect(screen.getAllByText('Condition').length).toBeGreaterThan(0)
    })

    describe('accepting', () => {
      async function open() {
        renderPage()
        await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))
        return dialog()
      }

      it('starts with the parent’s location and no coach, and offers only active coaches', async () => {
        const box = await open()
        expect(
          within(box).getByRole('heading', { name: 'Accept Noor Al Mahmood' }),
        ).toBeInTheDocument()
        await within(box).findByRole('option', { name: 'Khalid Al Dosari' })
        expect(within(box).queryByRole('option', { name: 'Retired Coach' })).not.toBeInTheDocument()
        expect(within(box).getByLabelText('Coach')).toHaveValue('')
        expect(within(box).getByLabelText('Location')).toHaveValue('loc-1')
      })

      it('sends the chosen coach and location, thanks the admin and closes', async () => {
        vi.mocked(api.acceptApplication).mockResolvedValue('new-player')
        const box = await open()
        await within(box).findByRole('option', { name: 'Khalid Al Dosari' })
        await userEvent.selectOptions(within(box).getByLabelText('Coach'), 'c1')
        await within(box).findByRole('option', { name: 'Hamad City' })
        await userEvent.selectOptions(within(box).getByLabelText('Location'), 'loc-2')
        await userEvent.click(within(box).getByRole('button', { name: 'Accept and add player' }))

        await waitFor(() =>
          expect(api.acceptApplication).toHaveBeenCalledWith({
            id: 'app-1',
            coachId: 'c1',
            locationId: 'loc-2',
          }),
        )
        expect(await screen.findByText('Noor Al Mahmood was added as a player')).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      })

      it('sends null for no coach and for no location', async () => {
        vi.mocked(api.acceptApplication).mockResolvedValue('new-player')
        const box = await open()
        await within(box).findByRole('option', { name: 'Hamad City' })
        await userEvent.selectOptions(within(box).getByLabelText('Location'), '')
        await userEvent.click(within(box).getByRole('button', { name: 'Accept and add player' }))
        await waitFor(() =>
          expect(api.acceptApplication).toHaveBeenCalledWith({
            id: 'app-1',
            coachId: null,
            locationId: null,
          }),
        )
      })

      it('says so, with a link to that player, when the CPR is taken', async () => {
        vi.mocked(api.acceptApplication).mockRejectedValue(new api.CprTakenError('p-old'))
        const box = await open()
        await userEvent.click(within(box).getByRole('button', { name: 'Accept and add player' }))
        expect(
          await within(box).findByText(
            /A player with this CPR already exists, so this request can't be accepted/,
          ),
        ).toBeInTheDocument()
        expect(within(box).getByRole('link', { name: 'Open that player' })).toHaveAttribute(
          'href',
          '/admin/players/p-old',
        )
        // still open, nothing was announced
        expect(screen.queryByText(/was added as a player/)).not.toBeInTheDocument()
      })

      it.each([
        ['ajyal:already_decided', 'This request was already decided'],
        ['ajyal:invalid_coach', 'Choose an active coach.'],
        ['ajyal:invalid_location', 'Choose an active location.'],
      ])('explains %s', async (code, text) => {
        vi.mocked(api.acceptApplication).mockRejectedValue({ message: code })
        const box = await open()
        await userEvent.click(within(box).getByRole('button', { name: 'Accept and add player' }))
        expect(await within(box).findByRole('alert')).toHaveTextContent(text)
      })

      it('never shows raw database text', async () => {
        vi.mocked(api.acceptApplication).mockRejectedValue({ message: 'relation does not exist' })
        const box = await open()
        await userEvent.click(within(box).getByRole('button', { name: 'Accept and add player' }))
        const alert = await within(box).findByRole('alert')
        expect(alert).not.toHaveTextContent('relation')
      })
    })

    describe('rejecting', () => {
      async function open() {
        renderPage()
        await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
        return dialog()
      }

      it('sends the note, and closes', async () => {
        vi.mocked(api.rejectApplication).mockResolvedValue()
        const box = await open()
        await userEvent.type(within(box).getByLabelText('Note for the team'), 'No places left')
        await userEvent.click(within(box).getByRole('button', { name: 'Reject request' }))
        await waitFor(() =>
          expect(api.rejectApplication).toHaveBeenCalledWith({
            id: 'app-1',
            note: 'No places left',
          }),
        )
        expect(
          await screen.findByText('The request for Noor Al Mahmood was rejected'),
        ).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      })

      it('needs no note', async () => {
        vi.mocked(api.rejectApplication).mockResolvedValue()
        const box = await open()
        await userEvent.click(within(box).getByRole('button', { name: 'Reject request' }))
        await waitFor(() =>
          expect(api.rejectApplication).toHaveBeenCalledWith({ id: 'app-1', note: '' }),
        )
      })

      it('says when the request was decided by someone else in the meantime', async () => {
        vi.mocked(api.rejectApplication).mockRejectedValue({ message: 'ajyal:already_decided' })
        const box = await open()
        await userEvent.click(within(box).getByRole('button', { name: 'Reject request' }))
        expect(await within(box).findByRole('alert')).toHaveTextContent('already decided')
      })

      it('promises nothing it does not do: the parent is not told by the app', async () => {
        const box = await open()
        expect(within(box).getByText(/The parent is not told automatically/)).toBeInTheDocument()
      })
    })
  })

  describe('after a decision', () => {
    const accepted = {
      ...pending,
      status: 'accepted' as const,
      decided_at: '2026-10-19T10:00:00Z',
      decided_by_name: 'Demo Admin',
      player_id: 'new-player',
    }

    it('shows who decided, links to the new player and hides the decision buttons', async () => {
      vi.mocked(api.getApplication).mockResolvedValue(accepted)
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Accepted' })).toBeInTheDocument()
      expect(screen.getByText('By Demo Admin on 19/10/2026')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open the player' })).toHaveAttribute(
        'href',
        '/admin/players/new-player',
      )
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    })

    it('offers a WhatsApp message in the language the parent used (Arabic), whatever the admin reads', async () => {
      vi.mocked(api.getApplication).mockResolvedValue(accepted)
      renderPage()
      const link = await screen.findByRole('link', { name: 'Message Mona Al Mahmood on WhatsApp' })
      const url = new URL(link.getAttribute('href')!)
      expect(url.origin + url.pathname).toBe('https://wa.me/97339001234')
      expect(url.searchParams.get('text')).toBe(
        'مرحباً Mona Al Mahmood، معكم أكاديمية أجيال. يسعدنا إبلاغكم بقبول تسجيل Noor Al Mahmood. أهلاً وسهلاً بكم في الأكاديمية! سنتواصل معكم بتفاصيل التدريب.',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      // the same text is shown before it is sent, in the parent's direction
      const preview = screen.getByText(/معكم أكاديمية أجيال. يسعدنا/)
      expect(preview).toHaveAttribute('dir', 'rtl')
    })

    it('writes the message in English when the parent used the English form', async () => {
      vi.mocked(api.getApplication).mockResolvedValue({ ...accepted, language: 'en' })
      renderPage()
      const link = await screen.findByRole('link', { name: /on WhatsApp/ })
      expect(new URL(link.getAttribute('href')!).searchParams.get('text')).toBe(
        'Hello Mona Al Mahmood, this is Ajyal Academy. Good news: the registration of Noor Al Mahmood has been accepted. Welcome to the academy! We will contact you with the training details.',
      )
    })

    it('has a kind message for a rejection, with the team’s note shown to admins only on screen', async () => {
      vi.mocked(api.getApplication).mockResolvedValue({
        ...pending,
        language: 'en',
        status: 'rejected',
        decided_at: '2026-10-19T10:00:00Z',
        decided_by_name: 'Demo Admin',
        decision_note: 'No places left',
      })
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Rejected' })).toBeInTheDocument()
      expect(screen.getByText('No places left')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /on WhatsApp/ })
      const text = new URL(link.getAttribute('href')!).searchParams.get('text')
      expect(text).toContain('Unfortunately we have no place available at the moment')
      // the internal note is not part of what the parent receives
      expect(text).not.toContain('No places left')
      expect(screen.queryByRole('link', { name: 'Open the player' })).not.toBeInTheDocument()
    })

    it('says so, instead of a broken link, when the phone number cannot be used for WhatsApp', async () => {
      vi.mocked(api.getApplication).mockResolvedValue({ ...accepted, phone: '12345' })
      renderPage()
      expect(await screen.findByText(/can't be used for WhatsApp/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /on WhatsApp/ })).not.toBeInTheDocument()
    })
  })

  it('handles a missing request and a failed load', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(null)
    renderPage('nope')
    expect(await screen.findByText('Request not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to requests' })).toBeInTheDocument()

    document.body.innerHTML = ''
    vi.mocked(api.getApplication).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load this request")).toBeInTheDocument()
    vi.mocked(api.getApplication).mockResolvedValue(pending)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Noor Al Mahmood' })).toBeInTheDocument()
  })

  it('reads in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('button', { name: 'قبول' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'رفض' })).toBeInTheDocument()
  })
})
