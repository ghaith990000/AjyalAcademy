import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeLocation, LOCATIONS } from '@/test/locations'
import * as api from './api'
import LocationsPage from './LocationsPage'

function renderPage() {
  return render(
    <Providers>
      <LocationsPage />
    </Providers>,
  )
}

describe('LocationsPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listLocations).mockResolvedValue([
      ...LOCATIONS,
      fakeLocation({ id: 'loc-4', name: 'Bilad Al Qadeem', address: 'Block 5, Road 12' }),
    ])
  })

  it('lists every location with its address and whether it is in use', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Locations' })).toBeInTheDocument()
    expect((await screen.findAllByText('Al-Rifa')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hamad City').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Block 5, Road 12').length).toBeGreaterThan(0)
    expect(screen.getAllByText('In use').length).toBeGreaterThan(0)
    // a switched-off location is still listed: past sessions and money point at it
    expect(screen.getAllByText('Old Field').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Switched off').length).toBeGreaterThan(0)
  })

  it('has an empty state that explains what a location is for, and a retry state', async () => {
    vi.mocked(api.listLocations).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No locations yet')).toBeInTheDocument()

    document.body.innerHTML = ''
    vi.mocked(api.listLocations).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load locations")).toBeInTheDocument()
    vi.mocked(api.listLocations).mockResolvedValue(LOCATIONS)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Al-Rifa')).length).toBeGreaterThan(0)
  })

  describe('adding a location', () => {
    async function openForm() {
      renderPage()
      await screen.findAllByText('Al-Rifa')
      await userEvent.click(screen.getAllByRole('button', { name: 'Add location' })[0]!)
      return screen.findByRole('dialog')
    }

    it('needs a name and does not call the server without one', async () => {
      const dialog = await openForm()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))
      expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument()
      expect(api.createLocation).not.toHaveBeenCalled()
    })

    it('saves the trimmed name, a blank address as null, and switched on', async () => {
      vi.mocked(api.createLocation).mockResolvedValue()
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), '  Isa Town field ')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))
      await waitFor(() =>
        expect(api.createLocation).toHaveBeenCalledWith({
          name: 'Isa Town field',
          address: null,
          active: true,
        }),
      )
      expect(await screen.findByText('Location added')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('says so when the name already exists', async () => {
      vi.mocked(api.createLocation).mockRejectedValue(new api.DuplicateLocationError())
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'al-rifa')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))
      expect(
        await within(dialog).findByText('A location with this name already exists'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('shows a generic message for an unexpected failure and keeps the form open', async () => {
      vi.mocked(api.createLocation).mockRejectedValue(new Error('boom'))
      const dialog = await openForm()
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'New place')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))
      expect(
        await screen.findByText('An unexpected error occurred. Please try again.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('editing a location', () => {
    async function openRow(name: string) {
      renderPage()
      const cells = await screen.findAllByText(name)
      await userEvent.click(cells[0]!)
      return screen.findByRole('dialog')
    }

    it('opens with the current values and saves a rename', async () => {
      vi.mocked(api.updateLocation).mockResolvedValue()
      const dialog = await openRow('Bilad Al Qadeem')
      expect(within(dialog).getByLabelText(/^Name/)).toHaveValue('Bilad Al Qadeem')
      expect(within(dialog).getByLabelText(/^Address/)).toHaveValue('Block 5, Road 12')
      expect(within(dialog).getByRole('switch')).toBeChecked()

      await userEvent.clear(within(dialog).getByLabelText(/^Name/))
      await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Bilad field')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
      await waitFor(() =>
        expect(api.updateLocation).toHaveBeenCalledWith('loc-4', {
          name: 'Bilad field',
          address: 'Block 5, Road 12',
          active: true,
        }),
      )
      expect(await screen.findByText('Location saved')).toBeInTheDocument()
    })

    it('switches a location off without deleting it', async () => {
      vi.mocked(api.updateLocation).mockResolvedValue()
      const dialog = await openRow('Hamad City')
      await userEvent.click(within(dialog).getByRole('switch'))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
      await waitFor(() =>
        expect(api.updateLocation).toHaveBeenCalledWith(
          'loc-2',
          expect.objectContaining({ active: false }),
        ),
      )
    })
  })
})
