import { cn } from '@/lib/utils'

interface FilterChipsProps<T extends string> {
  /** Accessible name of the group (already translated). */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /**
   * `wrap` (default) lets the chips flow onto more lines; `scroll` keeps one line that scrolls sideways inside
   * itself — for a long list of chips that would otherwise take a phone's whole screen.
   */
  layout?: 'wrap' | 'scroll'
}

/** A single-choice filter as a row of pills. The page itself never scrolls sideways. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  layout = 'wrap',
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2',
        layout === 'wrap'
          ? 'flex-wrap'
          : '-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap transition-colors',
              layout === 'scroll' && 'shrink-0',
              selected
                ? 'border-brand-blue bg-brand-blue text-white'
                : 'border-line bg-surface text-ink hover:bg-brand-blue-50',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
