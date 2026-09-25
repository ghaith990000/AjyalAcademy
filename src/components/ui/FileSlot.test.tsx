import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import * as storage from '@/lib/storage'
import { FileSlot, type FileSlotFailure } from './FileSlot'

vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof storage>()),
  uploadFile: vi.fn(),
  signedUrl: vi.fn(),
}))

function file(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

const failureMessage = (failure: FileSlotFailure) => `failure:${failure}`

function renderSlot(overrides: Partial<React.ComponentProps<typeof FileSlot>> = {}) {
  const onChange = vi.fn()
  render(
    <Providers>
      <FileSlot
        path={null}
        accept={storage.CPR_FILE_TYPES}
        buildPath={(f) => `players/p1/cpr-${f.name}`}
        onChange={onChange}
        chooseLabel="Choose file"
        replaceLabel="Replace file"
        removeLabel="Remove file"
        imageAlt="CPR document"
        pdfLabel="PDF document"
        failureMessage={failureMessage}
        {...overrides}
      />
    </Providers>,
  )
  return onChange
}

describe('FileSlot', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await i18n.changeLanguage('en')
    vi.mocked(storage.uploadFile).mockResolvedValue()
    vi.mocked(storage.signedUrl).mockResolvedValue('https://files.test/signed')
    URL.createObjectURL = vi.fn(() => 'blob:mock')
  })

  it('starts empty with a choose button', () => {
    renderSlot()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replace file' })).not.toBeInTheDocument()
  })

  it('uploads a picked file to its own path and reports it', async () => {
    const onChange = renderSlot()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file('scan.jpg', 'image/jpeg'))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('players/p1/cpr-scan.jpg'))
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'players/p1/cpr-scan.jpg',
      expect.objectContaining({ name: 'scan.jpg' }),
    )
    // Previewed instantly from the browser's own copy — no signed-url round trip needed yet.
    expect(storage.signedUrl).not.toHaveBeenCalled()
  })

  it('refuses a file of the wrong type before uploading anything', async () => {
    // The input's own `accept` is only a hint (drag-and-drop or "all files" can still offer a bad type),
    // so this is exercised with a raw change event rather than userEvent.upload (which enforces `accept`).
    const onChange = renderSlot({ accept: ['image/jpeg'] })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file('doc.pdf', 'application/pdf')], configurable: true })
    fireEvent.change(input)

    expect(await screen.findByText('failure:badType')).toBeInTheDocument()
    expect(storage.uploadFile).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a file over the size limit', async () => {
    renderSlot()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file('big.jpg', 'image/jpeg', storage.MAX_FILE_BYTES + 1))

    expect(await screen.findByText('failure:tooLarge')).toBeInTheDocument()
    expect(storage.uploadFile).not.toHaveBeenCalled()
  })

  it('shows the network failure message when the upload itself fails', async () => {
    vi.mocked(storage.uploadFile).mockRejectedValue(new TypeError('Failed to fetch'))
    renderSlot()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file('scan.jpg', 'image/jpeg'))

    expect(await screen.findByText('failure:network')).toBeInTheDocument()
  })

  it('resolves a signed URL to preview a path it did not just upload itself', async () => {
    renderSlot({ path: 'players/p1/cpr-existing.jpg' })
    await waitFor(() => expect(storage.signedUrl).toHaveBeenCalledWith('players/p1/cpr-existing.jpg'))
    const image = await screen.findByAltText('CPR document')
    expect(image).toHaveAttribute('src', 'https://files.test/signed')
  })

  it('shows a plain chip (no image) for a PDF, with its label', async () => {
    renderSlot({ path: 'players/p1/cpr-existing.pdf' })
    expect(await screen.findByText('PDF document')).toBeInTheDocument()
    expect(screen.queryByAltText('CPR document')).not.toBeInTheDocument()
  })

  it('replacing and removing', async () => {
    const onChange = renderSlot({ path: 'players/p1/cpr-existing.jpg' })
    await screen.findByRole('button', { name: 'Replace file' })

    await userEvent.click(screen.getByRole('button', { name: 'Remove file' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
  })
})
