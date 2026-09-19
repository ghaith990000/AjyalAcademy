import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { Button } from './Button'
import { DataList, type Column } from './DataList'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { Input } from './Input'
import { LanguageToggle } from './LanguageToggle'
import { Avatar } from './Avatar'

describe('Button', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('is disabled and announces busy state while loading', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: /Save/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(within(button).getByText('Loading')).toHaveClass('sr-only')
  })

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })

  it('renders the child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', '/x')
  })
})

describe('Field', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('wires label, hint and error to the control for assistive tech', () => {
    render(
      <Field label="CPR" hint="9 digits" error="Invalid CPR" required>
        {(control) => <Input {...control} />}
      </Field>,
    )
    const input = screen.getByLabelText(/CPR/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(2)
    expect(document.getElementById(describedBy.split(' ')[0]!)).toHaveTextContent('9 digits')
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid CPR')
  })

  it('omits invalid/described-by attributes when there is nothing to describe', () => {
    render(<Field label="Name">{(control) => <Input {...control} />}</Field>)
    const input = screen.getByLabelText('Name')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})

describe('Input', () => {
  it('forces left-to-right for phone/email style values', () => {
    render(<Input ltr aria-label="phone" />)
    expect(screen.getByLabelText('phone')).toHaveAttribute('dir', 'ltr')
  })
})

interface Row {
  id: string
  name: string
  school: string
}

describe('DataList', () => {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', primary: true, cell: (row) => row.name },
    { key: 'school', header: 'School', cell: (row) => row.school },
  ]
  const rows: Row[] = [
    { id: '1', name: 'Yousef', school: 'Al Rifa' },
    { id: '2', name: 'Ali', school: 'Hamad Town' },
  ]

  it('renders every row in both the table (md+) and the card list (phones)', () => {
    render(<DataList columns={columns} rows={rows} getRowKey={(row) => row.id} caption="Players" />)
    expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument()
    expect(screen.getAllByText('Yousef')).toHaveLength(2)
    expect(screen.getByRole('list', { name: 'Players' }).getAttribute('class')).toContain(
      'md:hidden',
    )
    expect(screen.getByRole('table').parentElement?.getAttribute('class')).toContain('hidden')
  })

  it('makes rows keyboard-activatable when onRowClick is given', async () => {
    const onRowClick = vi.fn()
    render(
      <DataList
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        caption="Players"
      />,
    )
    const tableRow = within(screen.getByRole('table')).getAllByRole('row')[1]!
    tableRow.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('shows the empty state instead of an empty table', () => {
    render(
      <DataList
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        empty={<p>Nothing here</p>}
        caption="Players"
      />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows skeletons while loading', () => {
    render(
      <DataList
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        loading
        caption="Players"
      />,
    )
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })
})

describe('LanguageToggle', () => {
  it('flips language and document direction, and labels the language you switch to', async () => {
    await i18n.changeLanguage('ar')
    render(<LanguageToggle />)
    expect(document.documentElement.dir).toBe('rtl')
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(document.documentElement.dir).toBe('ltr')
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('lang', 'ar')
    await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(document.documentElement.dir).toBe('rtl')
  })
})

describe('Dialog', () => {
  it('opens from its trigger, is labelled by its title, and closes with the close button', async () => {
    await i18n.changeLanguage('en')
    render(
      <Dialog trigger={<button>Open</button>} title="Remove player?" description="History is kept.">
        body
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove player?' })
    expect(dialog).toHaveAccessibleDescription('History is kept.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Avatar', () => {
  it('shows initials for Latin and Arabic names', () => {
    render(
      <>
        <Avatar name="Yousef Al Mahmood" />
        <Avatar name="يوسف المحمود" />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Yousef Al Mahmood' })).toHaveTextContent('YA')
    expect(screen.getByRole('img', { name: 'يوسف المحمود' })).toHaveTextContent('يا')
  })
})
