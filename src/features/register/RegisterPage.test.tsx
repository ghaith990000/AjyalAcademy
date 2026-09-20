import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import * as api from './api'
import RegisterPage from './RegisterPage'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  listPublicLocations: vi.fn(),
  submitApplications: vi.fn(),
}))

const LOCATIONS: api.PublicLocation[] = [
  { id: 'loc-1', name: 'Al-Rifa', address: null },
  { id: 'loc-2', name: 'Hamad City', address: 'Road 5' },
]

function renderPage() {
  return render(
    <Providers>
      <RegisterPage />
    </Providers>,
  )
}

// Typing key by key is slow with a form this size; a change event is what the form reacts to.
const setValue = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } })

/** Fills the parent section with valid values. */
function fillParent() {
  setValue(screen.getByLabelText(/Your name/), '  Mona Al Mahmood ')
  setValue(screen.getByLabelText(/Phone number/), '3900 1234')
}

function fillChild(card: HTMLElement, name = 'Yousef Al Mahmood', cpr = '150312345') {
  setValue(within(card).getByLabelText(/Child's full name/), name)
  setValue(within(card).getByLabelText(/CPR number/), cpr)
  setValue(within(card).getByLabelText(/Date of birth/), '2015-03-12')
}

const childCard = (n: number) => screen.getByRole('group', { name: `Child ${n}` })
const send = () => userEvent.click(screen.getByRole('button', { name: 'Send registration' }))

async function fillEverything() {
  fillParent()
  await userEvent.selectOptions(await screen.findByLabelText(/Preferred location/), 'loc-1')
  fillChild(childCard(1))
  await userEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
}

describe('RegisterPage', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(api.listPublicLocations).mockResolvedValue(LOCATIONS)
    vi.mocked(api.submitApplications).mockResolvedValue()
  })

  it('opens with the parent section and one child, in either language', async () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Register your child' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parent or guardian' })).toBeInTheDocument()
    expect(childCard(1)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Child 2' })).not.toBeInTheDocument()

    await i18n.changeLanguage('ar')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'تسجيل لاعب جديد' }),
    ).toBeInTheDocument()
  })

  it('asks for everything that is missing and sends nothing', async () => {
    renderPage()
    await screen.findByLabelText(/Preferred location/)
    await send()
    expect(await screen.findByText('Enter your name')).toBeInTheDocument()
    expect(screen.getByText('Enter a phone number')).toBeInTheDocument()
    expect(screen.getByText('Choose a location', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText("Enter the child's name")).toBeInTheDocument()
    expect(screen.getByText('The CPR must be exactly 9 digits')).toBeInTheDocument()
    expect(screen.getByText('Enter the date of birth')).toBeInTheDocument()
    expect(screen.getByText('Please confirm that the information is correct')).toBeInTheDocument()
    expect(api.submitApplications).not.toHaveBeenCalled()
  })

  it('sends the trimmed answers with the language and the chosen location, then thanks the parent', async () => {
    renderPage()
    await fillEverything()
    await send()

    await waitFor(() => expect(api.submitApplications).toHaveBeenCalledOnce())
    expect(api.submitApplications).toHaveBeenCalledWith({
      submissionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      guardianName: 'Mona Al Mahmood',
      phone: '3900 1234',
      locationId: 'loc-1',
      language: 'en',
      children: [
        {
          full_name: 'Yousef Al Mahmood',
          cpr: '150312345',
          date_of_birth: '2015-03-12',
          address: null,
          school: null,
          has_disease: false,
          disease_description: null,
        },
      ],
      website: '',
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you!' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'We received the registration request for Yousef Al Mahmood.',
    )
    expect(screen.getByText('3900 1234')).toBeInTheDocument()
  })

  it('sends the language the parent is using', async () => {
    await i18n.changeLanguage('ar')
    renderPage()
    setValue(screen.getByLabelText(/اسمك/), 'منى')
    setValue(screen.getByLabelText(/رقم الهاتف/), '39001234')
    await userEvent.selectOptions(await screen.findByLabelText(/الموقع المفضّل/), 'loc-2')
    const card = screen.getByRole('group', { name: 'الطفل 1' })
    setValue(within(card).getByLabelText(/الاسم الكامل للطفل/), 'يوسف')
    setValue(within(card).getByLabelText(/الرقم الشخصي/), '150312345')
    fireEvent.change(within(card).getByLabelText(/تاريخ الميلاد/), {
      target: { value: '2015-03-12' },
    })
    await userEvent.click(screen.getByRole('checkbox', { name: /أؤكد/ }))
    await userEvent.click(screen.getByRole('button', { name: 'إرسال الطلب' }))
    await waitFor(() =>
      expect(api.submitApplications).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'ar', locationId: 'loc-2', guardianName: 'منى' }),
      ),
    )
  })

  it('takes up to four children, each on its own card, and can remove one', async () => {
    renderPage()
    const add = () => userEvent.click(screen.getByRole('button', { name: 'Add another child' }))
    await add()
    await add()
    await add()
    expect(childCard(4)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add another child' })).not.toBeInTheDocument()
    expect(
      screen.getByText('You can register up to 4 children in one request.'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove child 2' }))
    expect(screen.queryByRole('group', { name: 'Child 4' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another child' })).toBeInTheDocument()
  })

  it('has no remove button while there is only one child', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /Remove child/ })).not.toBeInTheDocument()
  })

  it('sends every child and lists their names on the thank-you screen', async () => {
    renderPage()
    await fillEverything()
    await userEvent.click(screen.getByRole('button', { name: 'Add another child' }))
    fillChild(childCard(2), 'Noor Al Mahmood', '150312346')
    await send()

    await waitFor(() => expect(api.submitApplications).toHaveBeenCalledOnce())
    const sent = vi.mocked(api.submitApplications).mock.calls[0]![0]
    expect(sent.children.map((c) => c.full_name)).toEqual(['Yousef Al Mahmood', 'Noor Al Mahmood'])
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Yousef Al Mahmood and Noor Al Mahmood',
    )
  })

  it('points at the card whose CPR repeats another child’s', async () => {
    renderPage()
    await fillEverything()
    await userEvent.click(screen.getByRole('button', { name: 'Add another child' }))
    fillChild(childCard(2), 'Noor', '150312345')
    await send()
    expect(
      await within(childCard(2)).findByText('This CPR is used for another child in this form'),
    ).toBeInTheDocument()
    expect(api.submitApplications).not.toHaveBeenCalled()
  })

  it('asks for a description when a child has a medical condition', async () => {
    renderPage()
    await fillEverything()
    await userEvent.click(within(childCard(1)).getByRole('switch', { name: /medical condition/ }))
    await send()
    expect(
      await within(childCard(1)).findByText('Describe the condition', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(api.submitApplications).not.toHaveBeenCalled()

    setValue(within(childCard(1)).getByLabelText(/Describe the condition/), 'Asthma')
    await send()
    await waitFor(() =>
      expect(api.submitApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          children: [expect.objectContaining({ has_disease: true, disease_description: 'Asthma' })],
        }),
      ),
    )
  })

  it('offers the active locations, and no location field when there are none', async () => {
    renderPage()
    const select = await screen.findByLabelText(/Preferred location/)
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a location', 'Al-Rifa', 'Hamad City'])

    document.body.innerHTML = ''
    vi.mocked(api.listPublicLocations).mockResolvedValue([])
    renderPage()
    fillParent()
    fillChild(childCard(1))
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
    expect(screen.queryByLabelText(/Preferred location/)).not.toBeInTheDocument()
    await send()
    await waitFor(() =>
      expect(api.submitApplications).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: null }),
      ),
    )
  })

  it('can still be sent when the list of locations could not be loaded', async () => {
    vi.mocked(api.listPublicLocations).mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    fillParent()
    fillChild(childCard(1))
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
    await send()
    await waitFor(() => expect(api.submitApplications).toHaveBeenCalledOnce())
  })

  describe('when sending fails', () => {
    it('keeps every answer and lets the parent press send again — with the same submission id', async () => {
      vi.mocked(api.submitApplications)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce()
      renderPage()
      await fillEverything()
      await send()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent("We couldn't reach the server")
      expect(alert).toHaveTextContent('your answers are still here')
      expect(screen.getByLabelText(/Your name/)).toHaveValue('  Mona Al Mahmood ')

      await send()
      await waitFor(() => expect(api.submitApplications).toHaveBeenCalledTimes(2))
      const [first, second] = vi.mocked(api.submitApplications).mock.calls.map(([input]) => input)
      expect(second!.submissionId).toBe(first!.submissionId)
      expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeInTheDocument()
    })

    it.each([
      ['ajyal:rate_limited', 'Too many requests were sent from this number today'],
      ['ajyal:invalid_input', 'Some details were not accepted'],
      ['ajyal:duplicate_child', 'Two children have the same CPR'],
      ['ajyal:too_many_children', 'Some details were not accepted'],
    ])('explains %s', async (code, text) => {
      vi.mocked(api.submitApplications).mockRejectedValue({ message: code })
      renderPage()
      await fillEverything()
      await send()
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      expect(screen.queryByRole('heading', { name: 'Thank you!' })).not.toBeInTheDocument()
    })

    it('says something generic for anything else, never the raw database text', async () => {
      vi.mocked(api.submitApplications).mockRejectedValue({
        message: 'permission denied for table x',
      })
      renderPage()
      await fillEverything()
      await send()
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Something went wrong')
      expect(alert).not.toHaveTextContent('permission denied')
    })

    it('marks the location field when it was switched off in the meantime', async () => {
      vi.mocked(api.submitApplications).mockRejectedValue({ message: 'ajyal:invalid_location' })
      renderPage()
      await fillEverything()
      await send()
      expect(
        await screen.findByText('That location is no longer available. Choose another one.'),
      ).toBeInTheDocument()
    })
  })

  it('passes on what a bot typed into the hidden field (the database ignores such requests)', async () => {
    const { container } = renderPage()
    await fillEverything()
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]')!
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    fireEvent.change(trap, { target: { value: 'http://spam.example' } })
    await send()
    await waitFor(() =>
      expect(api.submitApplications).toHaveBeenCalledWith(
        expect.objectContaining({ website: 'http://spam.example' }),
      ),
    )
  })

  it('starts a fresh form, with a new submission id, for "Register another child"', async () => {
    renderPage()
    await fillEverything()
    await send()
    await userEvent.click(await screen.findByRole('button', { name: 'Register another child' }))

    expect(screen.getByLabelText(/Your name/)).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: /I confirm/ })).not.toBeChecked()
    await fillEverything()
    await send()
    await waitFor(() => expect(api.submitApplications).toHaveBeenCalledTimes(2))
    const [first, second] = vi.mocked(api.submitApplications).mock.calls.map(([input]) => input)
    expect(second!.submissionId).not.toBe(first!.submissionId)
  })
})
