import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './categories'

interface CategoryChipsProps {
  value: ExpenseCategory | 'all'
  onChange: (value: ExpenseCategory | 'all') => void
}

/** "All" plus one chip per category — single choice, wraps on phones so nothing scrolls sideways. */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const { t } = useTranslation('expenses')
  const options = ['all', ...EXPENSE_CATEGORIES] as const

  return (
    <div role="group" aria-label={t('filters.category')} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-[15px] font-semibold transition-colors',
              selected
                ? 'border-brand-blue bg-brand-blue text-white'
                : 'border-line bg-surface text-ink hover:bg-brand-blue-50',
            )}
          >
            {option === 'all' ? t('filters.all') : t(`category.${option}`)}
          </button>
        )
      })}
    </div>
  )
}
