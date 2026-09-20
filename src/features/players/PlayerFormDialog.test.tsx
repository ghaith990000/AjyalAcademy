import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { AuthContext } from '@/features/auth/auth-context'
import * as coachesApi from '@/features/coaches/api'
import i18n from '@/lib/i18n'
import { fakeAuth, fakeProfile } from '@/test/auth'
import { fakePlayer } from '@/test/players'
import * as api from './api'
import { PlayerFormDialog } from './PlayerFormDialog'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  createPlayer: vi.fn(),
  updatePlayer: vi.fn(),
}))
vi.mock('@/features/coaches/api', async (importOriginal) => ({
  ...(await importOriginal<typeof coachesApi>()),
  listCoaches: vi.fn(),
}))

const onClose = vi.fn()
const onSaved = vi.fn()

function renderForm(role: 'admin' | 'coach' = 'coach', player?: api.PlayerRow) {
  render(
    <Providers>
      <AuthContext.Provider value={fakeAuth(role)}>
        <MemoryRouter>
          <PlayerFormDialog player={player} onClose={onClose} onSaved={onSaved} />
        </MemoryRouter>
      </AuthContext.Provider>
    </Providers>,
  )
  return screen.findByRole('dialog')
}

/** Fill every required field with valid data. */
async function fillValid(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText(/Full name/), '  Yousef Al Mahmood ')
  await userEvent.type(within(dialog).getByLabelText(/^CPR/), '150312345')
  fireEvent.change(within(dialog).getByLabelText(/Date of birth/), {
    target: { value: '2015-03-12' },
  })
  await userEvent.type(within(dialog).getByLabelText(/^Phone/), '39111001')
}

const submit = (dialog: HTMLElement, name = 'Add player') =>
  userEvent.click(within(dialog).getByRole('button', { name }))

describe('PlayerFormDialog', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(coachesApi.listCoaches).mockResolvedValue([
      fakeProfile('coach', { id: 'c1', full_name: 'Khalid Al Dosari' }),
      fakeProfile('coach', { id: 'c2', full_name: 'Sara Al Khalifa' }),
      fakeProfile('coach', { id: 'c3', full_name: 'Retired Coach', active: false }),
    ])
  })

  describe('validation', () => {
    it('asks for every required field and does not call the server', async () => {
      const dialog = await renderForm()
      await submit(dialog)
      expect(await within(dialog).findByText("Enter the player's name")).toBeInTheDocument()
      expect(within(dialog).getByText('The CPR must be exactly 9 digits')).toBeInTheDocument()
      expect(within(dialog).getByText('Enter the date of birth')).toBeInTheDocument()
      expect(within(dialog).getByText('Enter a phone number')).toBeInTheDocument()
      expect(api.createPlayer).not.toHaveBeenCalled()
    })

    it('rejects a CPR that is not 9 digits', async () => {
      const dialog = await renderForm()
      await fillValid(dialog)
      const cpr = within(dialog).getByLabelText(/^CPR/)
      await userEvent.clear(cpr)
      await userEvent.type(cpr, '12345678')
      await submit(dialog)
      expect(
        await within(dialog).findByText('The CPR must be exactly 9 digits'),
      ).toBeInTheDocument()
    })

    it('rejects a date of birth in the future', async () => {
      const dialog = await renderForm()
      await fillValid(dialog)
      fireEvent.change(within(dialog).getByLabelText(/Date of birth/), {
        target: { value: '2999-01-01' },
      })
      await submit(dialog)
      expect(
        await within(dialog).findByText('The date of birth must be in the past'),
      ).toBeInTheDocument()
      expect(api.createPlayer).not.toHaveBeenCalled()
    })

    it('gives the CPR field a numeric keypad, and phone a telephone one', async () => {
      const dialog = await renderForm()
      expect(within(dialog).getByLabelText(/^CPR/)).toHaveAttribute('inputmode', 'numeric')
      expect(within(dialog).getByLabelText(/^Phone/)).toHaveAttribute('inputmode', 'tel')
    })
  })

  describe('medical condition', () => {
    it('hides the description until the switch is on, then requires it', async () => {
      const dialog = await renderForm()
      await fillValid(dialog)
      expect(within(dialog).queryByLabelText(/Describe the condition/)).not.toBeInTheDocument()

      await userEvent.click(within(dialog).getByRole('switch', { name: /Has a medical condition/ }))
      expect(within(dialog).getByLabelText(/Describe the condition/)).toBeInTheDocument()

      await submit(dialog)
      // the label and the error share this text, so look at the error (an alert) specifically
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Describe the condition')
      expect(api.createPlayer).not.toHaveBeenCalled()
    })

    it('saves the description when there is a condition', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new' })
      const dialog = await renderForm()
      await fillValid(dialog)
      await userEvent.click(within(dialog).getByRole('switch', { name: /Has a medical condition/ }))
      await userEvent.type(
        within(dialog).getByLabelText(/Describe the condition/),
        'Asthma — carries an inhaler',
      )
      await submit(dialog)
      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            has_disease: true,
            disease_description: 'Asthma — carries an inhaler',
          }),
        ),
      )
    })

    it('drops a typed description again if the switch is turned back off', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new' })
      const dialog = await renderForm()
      await fillValid(dialog)
      const toggle = within(dialog).getByRole('switch', { name: /Has a medical condition/ })
      await userEvent.click(toggle)
      await userEvent.type(within(dialog).getByLabelText(/Describe the condition/), 'oops')
      await userEvent.click(toggle)
      await submit(dialog)
      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith(
          expect.objectContaining({ has_disease: false, disease_description: null }),
        ),
      )
    })
  })

  describe('creating a player', () => {
    it('as a coach: sends trimmed values, null for blanks, no coach, then reports success', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new-id' })
      const dialog = await renderForm('coach')
      expect(within(dialog).queryByLabelText('Coach')).not.toBeInTheDocument()
      await fillValid(dialog)
      await submit(dialog)

      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith({
          full_name: 'Yousef Al Mahmood',
          cpr: '150312345',
          date_of_birth: '2015-03-12',
          address: null,
          school: null,
          phone: '39111001',
          has_disease: false,
          disease_description: null,
          location_id: null,
        }),
      )
      expect(await screen.findByText('Player added')).toBeInTheDocument()
      expect(onSaved).toHaveBeenCalledWith('new-id')
      expect(onClose).toHaveBeenCalled()
    })

    it('sends the chosen location, and none by default', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new' })
      const dialog = await renderForm('coach')
      await fillValid(dialog)
      await within(dialog).findByRole('option', { name: 'Hamad City' })
      await userEvent.selectOptions(within(dialog).getByLabelText('Location'), 'loc-2')
      await submit(dialog)
      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith(
          expect.objectContaining({ location_id: 'loc-2' }),
        ),
      )
    })

    it('as an admin: offers active coaches and sends the chosen one', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new' })
      const dialog = await renderForm('admin')
      const coach = await within(dialog).findByLabelText('Coach')
      await within(dialog).findByRole('option', { name: 'Sara Al Khalifa' })
      expect(
        within(dialog).queryByRole('option', { name: 'Retired Coach' }),
      ).not.toBeInTheDocument()

      await fillValid(dialog)
      await userEvent.selectOptions(coach, 'c2')
      await submit(dialog)
      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith(expect.objectContaining({ coach_id: 'c2' })),
      )
    })

    it('as an admin: leaves the player unassigned by default (coach_id null)', async () => {
      vi.mocked(api.createPlayer).mockResolvedValue({ id: 'new' })
      const dialog = await renderForm('admin')
      await fillValid(dialog)
      await submit(dialog)
      await waitFor(() =>
        expect(api.createPlayer).toHaveBeenCalledWith(expect.objectContaining({ coach_id: null })),
      )
    })
  })

  describe('a CPR that is already registered', () => {
    it('links to the existing player when the user may see them', async () => {
      vi.mocked(api.createPlayer).mockRejectedValue(
        new api.DuplicateCprError({ id: 'existing', full_name: 'Ali Hassan' }),
      )
      const dialog = await renderForm('coach')
      await fillValid(dialog)
      await submit(dialog)
      const link = await within(dialog).findByRole('link', { name: 'Open Ali Hassan' })
      expect(link).toHaveAttribute('href', '/coach/players/existing')
      expect(within(dialog).getByText(/already exists/)).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled() // the form stays open so the CPR can be fixed
    })

    it('does not reveal a player the user cannot see', async () => {
      vi.mocked(api.createPlayer).mockRejectedValue(new api.DuplicateCprError(null))
      const dialog = await renderForm('coach')
      await fillValid(dialog)
      await submit(dialog)
      expect(
        await within(dialog).findByText(/already registered with another coach/),
      ).toBeInTheDocument()
      expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
    })

    it('clears the duplicate message once the CPR is edited', async () => {
      vi.mocked(api.createPlayer).mockRejectedValue(new api.DuplicateCprError(null))
      const dialog = await renderForm('coach')
      await fillValid(dialog)
      await submit(dialog)
      await within(dialog).findByText(/already registered with another coach/)
      await userEvent.type(within(dialog).getByLabelText(/^CPR/), '{Backspace}')
      await submit(dialog)
      expect(
        await within(dialog).findByText('The CPR must be exactly 9 digits'),
      ).toBeInTheDocument()
    })
  })

  it('shows a translated toast for an unexpected failure and stays open', async () => {
    vi.mocked(api.createPlayer).mockRejectedValue(new TypeError('Failed to fetch'))
    const dialog = await renderForm()
    await fillValid(dialog)
    await submit(dialog)
    expect(
      await screen.findByText("Can't reach the server. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('editing', () => {
    const existing = fakePlayer({
      id: 'p9',
      full_name: 'Ali Hassan',
      cpr: '140708821',
      date_of_birth: '2014-08-07',
      school: 'Al Rifa',
      has_disease: true,
      disease_description: 'Asthma',
    })

    it('prefills the form, has no coach picker, and never sends the coach', async () => {
      vi.mocked(api.updatePlayer).mockResolvedValue(undefined)
      const dialog = await renderForm('admin', existing)
      expect(within(dialog).getByLabelText(/Full name/)).toHaveValue('Ali Hassan')
      expect(within(dialog).getByLabelText(/^CPR/)).toHaveValue('140708821')
      expect(within(dialog).getByLabelText(/Describe the condition/)).toHaveValue('Asthma')
      expect(within(dialog).queryByLabelText('Coach')).not.toBeInTheDocument()

      const school = within(dialog).getByLabelText(/School/)
      await userEvent.clear(school)
      await userEvent.type(school, 'New School')
      await submit(dialog, 'Save changes')

      await waitFor(() => expect(api.updatePlayer).toHaveBeenCalled())
      const [id, input] = vi.mocked(api.updatePlayer).mock.calls[0]!
      expect(id).toBe('p9')
      expect(input).toMatchObject({
        school: 'New School',
        has_disease: true,
        disease_description: 'Asthma',
      })
      expect(input).not.toHaveProperty('coach_id')
      expect(await screen.findByText('Player updated')).toBeInTheDocument()
      expect(onSaved).toHaveBeenCalledWith('p9')
    })
  })
})
