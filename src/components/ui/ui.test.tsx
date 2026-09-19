import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { EmptyState } from './EmptyState'
import { DataList, type Column } from './DataList'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { FilterChips } from './FilterChips'
import { Input } from './Input'
import { LanguageToggle } from './LanguageToggle'
import { Money } from './Money'
import { StatCard } from './StatCard'
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

  it('makes each phone card one button when nothing inside it is a control', async () => {
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
    const list = screen.getByRole('list', { name: 'Players' })
    const cards = within(list).getAllByRole('button')
    expect(cards).toHaveLength(2)
    await userEvent.click(cards[1]!)
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })

  it('does not make a card a button when its cells hold their own controls (a button may not contain one)', async () => {
    const onRowClick = vi.fn()
    const withCheckbox: Column<Row>[] = [
      {
        key: 'name',
        header: 'Name',
        primary: true,
        cell: (row) => <Checkbox aria-label={`Select ${row.name}`} />,
      },
    ]
    render(
      <DataList
        columns={withCheckbox}
        rows={rows}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        nestedControls
        caption="Players"
      />,
    )
    const list = screen.getByRole('list', { name: 'Players' })
    // the only buttons/checkboxes inside the cards are the checkboxes themselves
    expect(within(list).queryAllByRole('button')).toHaveLength(0)
    expect(within(list).getAllByRole('checkbox')).toHaveLength(2)
    // a tap on the card still opens the row
    await userEvent.click(list.querySelectorAll('li > div')[0]!)
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

describe('Checkbox', () => {
  it('is a 44px tap target that looks like a 24px box and does not move its neighbours', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Select Ali" onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Select Ali' })
    expect(box.className).toContain('size-11')
    expect(box.className).toContain('-m-2.5') // 44 − 2×10 = 24px of layout
    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(box).toHaveAttribute('data-state', 'checked')
  })
})

describe('EmptyState', () => {
  it('is a level-2 heading inside a page and can be the page heading itself', () => {
    const { rerender } = render(<EmptyState icon={Users} title="Nothing here" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here' })).toBeInTheDocument()
    rerender(<EmptyState icon={Users} title="Nothing here" titleAs="h1" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nothing here' })).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('shows the label, the value and a hint', () => {
    render(<StatCard label="Active players" value="42" icon={Users} hint="This month" />)
    expect(screen.getByText('Active players')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('This month')).toBeInTheDocument()
  })

  it('has a compact form with the icon beside the label', () => {
    render(<StatCard compact label="Collected" value={<span>540.000 BD</span>} icon={Users} />)
    const label = screen.getByText('Collected').closest('p')!
    expect(label.querySelector('svg')).not.toBeNull() // the icon sits in the label row
    expect(screen.getByText('540.000 BD')).toBeInTheDocument()
  })

  it('accepts a block-level value (a loading skeleton) without invalid nesting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<StatCard compact label="Players" value={<div data-testid="skeleton" />} icon={Users} />)
    render(<StatCard label="Players" value={<div data-testid="skeleton2" />} icon={Users} />)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'players', label: 'Players' },
    { value: 'sessions', label: 'Sessions' },
  ] as const

  it('is a labelled group of pressed / not-pressed buttons', () => {
    render(<FilterChips label="Show" options={options} value="players" onChange={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Show' })
    expect(within(group).getByRole('button', { name: 'Players' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the chosen value', async () => {
    const onChange = vi.fn()
    render(<FilterChips label="Show" options={options} value="all" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sessions' }))
    expect(onChange).toHaveBeenCalledWith('sessions')
  })

  it('wraps by default and can keep to one scrolling line instead', () => {
    const { rerender } = render(
      <FilterChips label="Show" options={options} value="all" onChange={vi.fn()} />,
    )
    expect(screen.getByRole('group', { name: 'Show' }).className).toContain('flex-wrap')
    rerender(
      <FilterChips label="Show" options={options} value="all" onChange={vi.fn()} layout="scroll" />,
    )
    const group = screen.getByRole('group', { name: 'Show' })
    expect(group.className).toContain('overflow-x-auto')
    expect(group.className).not.toContain('flex-wrap')
    for (const chip of screen.getAllByRole('button')) expect(chip.className).toContain('shrink-0')
  })

  it('keeps every chip at least 44px tall (a phone tap target)', () => {
    render(<FilterChips label="Show" options={options} value="all" onChange={vi.fn()} />)
    for (const chip of screen.getAllByRole('button')) expect(chip.className).toContain('min-h-11')
  })
})

describe('Money', () => {
  it('shows an amount with its unit in the active language', async () => {
    await i18n.changeLanguage('en')
    const { unmount } = render(<Money fils={540_000} />)
    expect(screen.getByText('540.000 BD')).toBeInTheDocument()
    unmount()
    await i18n.changeLanguage('ar')
    render(<Money fils={540_000} />)
    expect(screen.getByText('540.000 د.ب')).toBeInTheDocument()
  })

  it('keeps a negative amount left-to-right so the minus sign stays in front of the digits', async () => {
    await i18n.changeLanguage('ar')
    const { container } = render(<Money fils={-20_000} />)
    const number = screen.getByText('-20.000')
    expect(number.tagName).toBe('BDI')
    expect(number).toHaveAttribute('dir', 'ltr')
    expect(container).toHaveTextContent('-20.000 د.ب')
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
