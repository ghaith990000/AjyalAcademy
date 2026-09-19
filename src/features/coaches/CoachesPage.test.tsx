import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeProfile } from '@/test/auth'
import * as api from './api'
import CoachesPage from './CoachesPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listCoaches: vi.fn(),
  createCoach: vi.fn(),
  updateCoach: vi.fn(),
}))

const khalid = fakeProfile('coach', {
  id: 'c1',
  full_name: 'Khalid Al Dosari',
  email: 'khalid@example.com',
  phone: '36000001',
  monthly_salary_fils: 250_000,
})
const sara = fakeProfile('coach', {
  id: 'c2',
  full_name: 'Sara Al Khalifa',
  email: 'sara@example.com',
  monthly_salary_fils: 200_500,
  active: false,
})

function renderPage() {
  return render(
    <Providers>
      <CoachesPage />
    </Providers>,
  )
}

/** The page renders both a table and a card list; the table is the accessible one on desktop. */
const cells = () => screen.getAllByText('Khalid Al Dosari')

describe('CoachesPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listCoaches).mockResolvedValue([khalid, sara])
  })

  it('lists coaches with salary in BD and an active/inactive badge', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Coaches' })).toBeInTheDocument()
    await screen.findAllByText('Sara Al Khalifa')
    expect(screen.getAllByText('250.000 BD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('200.500 BD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })

  it('shows an empty state with an add action when there are no coaches', async () => {
    vi.mocked(api.listCoaches).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No coaches yet')).toBeInTheDocument()
  })

  it('shows a retry state when loading fails', async () => {
    vi.mocked(api.listCoaches).mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load coaches")).toBeInTheDocument()
    vi.mocked(api.listCoaches).mockResolvedValue([khalid])
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Khalid Al Dosari')).length).toBeGreaterThan(0)
  })

  describe('adding a coach', () => {
    async function openForm() {
      renderPage()
      await screen.findAllByText('Khalid Al Dosari')
      await userEvent.click(screen.getAllByRole('button', { name: 'Add coach' })[0]!)
      return await screen.findByRole('dialog', { name: 'Add coach' })
    }

    it('validates required fields and password length before calling the server', async () => {
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Temporary password/), 'short')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))
      expect(await within(dialog).findByText("Enter the coach's name")).toBeInTheDocument()
      expect(within(dialog).getByText('Enter an email address')).toBeInTheDocument()
      expect(within(dialog).getByText('Use at least 8 characters')).toBeInTheDocument()
      expect(api.createCoach).not.toHaveBeenCalled()
    })

    it('rejects a salary that is not a BD amount', async () => {
      const dialog = await openForm()
      const salary = within(dialog).getByLabelText(/Monthly salary/)
      await userEvent.clear(salary)
      await userEvent.type(salary, '12.3456')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))
      expect(
        await within(dialog).findByText('Enter an amount such as 250 or 250.500'),
      ).toBeInTheDocument()
    })

    it('creates the coach, sending the salary as integer fils, and confirms with a toast', async () => {
      vi.mocked(api.createCoach).mockResolvedValue({ id: 'new' })
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Full name/), '  Omar Ali ')
      await userEvent.type(within(dialog).getByLabelText(/^Email/), 'Omar@Example.com')
      await userEvent.type(within(dialog).getByLabelText(/Temporary password/), 'Welcome#2026')
      await userEvent.type(within(dialog).getByLabelText(/^Phone/), '39001122')
      const salary = within(dialog).getByLabelText(/Monthly salary/)
      await userEvent.clear(salary)
      await userEvent.type(salary, '312.5')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))

      expect(api.createCoach).toHaveBeenCalledWith({
        full_name: 'Omar Ali',
        email: 'omar@example.com',
        password: 'Welcome#2026',
        phone: '39001122',
        monthly_salary_fils: 312_500,
        preferred_language: 'ar',
      })
      expect(await screen.findByText('Coach added')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('reports an already-registered email on the email field and keeps the form open', async () => {
      vi.mocked(api.createCoach).mockRejectedValue(new api.CreateCoachError('email_taken'))
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Omar Ali')
      await userEvent.type(within(dialog).getByLabelText(/^Email/), 'khalid@example.com')
      await userEvent.type(within(dialog).getByLabelText(/Temporary password/), 'Welcome#2026')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))
      expect(
        await within(dialog).findByText('This email is already registered'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('reports a weak password on the password field', async () => {
      vi.mocked(api.createCoach).mockRejectedValue(new api.CreateCoachError('weak_password'))
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Omar Ali')
      await userEvent.type(within(dialog).getByLabelText(/^Email/), 'omar@example.com')
      await userEvent.type(within(dialog).getByLabelText(/Temporary password/), '12345678')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))
      expect(
        await within(dialog).findByText('This password is too weak. Try a longer one.'),
      ).toBeInTheDocument()
    })

    it('shows a translated error toast for unexpected failures', async () => {
      vi.mocked(api.createCoach).mockRejectedValue(new TypeError('Failed to fetch'))
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Omar Ali')
      await userEvent.type(within(dialog).getByLabelText(/^Email/), 'omar@example.com')
      await userEvent.type(within(dialog).getByLabelText(/Temporary password/), 'Welcome#2026')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create coach' }))
      expect(
        await screen.findByText("Can't reach the server. Check your connection and try again."),
      ).toBeInTheDocument()
    })
  })

  describe('editing a coach', () => {
    async function openEdit() {
      renderPage()
      await userEvent.click((await screen.findAllByText('Khalid Al Dosari'))[0]!)
      return await screen.findByRole('dialog', { name: 'Edit coach' })
    }

    it('loads the coach, keeps the email read-only, and shows the salary in BD', async () => {
      const dialog = await openEdit()
      expect(within(dialog).getByLabelText('Email')).toBeDisabled()
      expect(within(dialog).getByLabelText(/Full name/)).toHaveValue('Khalid Al Dosari')
      expect(within(dialog).getByLabelText(/Monthly salary/)).toHaveValue('250')
      expect(within(dialog).getByRole('switch', { name: /Active/ })).toBeChecked()
    })

    it('saves changes, including deactivating the coach', async () => {
      vi.mocked(api.updateCoach).mockResolvedValue(undefined)
      const dialog = await openEdit()
      const salary = within(dialog).getByLabelText(/Monthly salary/)
      await userEvent.clear(salary)
      await userEvent.type(salary, '275.250')
      await userEvent.click(within(dialog).getByRole('switch', { name: /Active/ }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

      expect(api.updateCoach).toHaveBeenCalledWith('c1', {
        full_name: 'Khalid Al Dosari',
        phone: '36000001',
        monthly_salary_fils: 275_250,
        active: false,
      })
      expect(await screen.findByText('Coach updated')).toBeInTheDocument()
    })
  })

  it('renders in Arabic too', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'المدربون' })).toBeInTheDocument()
    await screen.findAllByText('Sara Al Khalifa')
    expect(screen.getAllByText('200.500 د.ب').length).toBeGreaterThan(0)
    expect(cells().length).toBeGreaterThan(0)
  })
})
