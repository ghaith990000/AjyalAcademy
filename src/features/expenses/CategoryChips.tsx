import { useTranslation } from 'react-i18next'
import { FilterChips } from '@/components/ui/FilterChips'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './categories'

interface CategoryChipsProps {
  value: ExpenseCategory | 'all'
  onChange: (value: ExpenseCategory | 'all') => void
}

/** "All" plus one chip per expense category. */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const { t } = useTranslation('expenses')
  const options = [
    { value: 'all', label: t('filters.all') },
    ...EXPENSE_CATEGORIES.map((category) => ({
      value: category,
      label: t(`category.${category}`),
    })),
  ] as const

  return (
    <FilterChips
      label={t('filters.category')}
      options={options}
      value={value}
      onChange={onChange}
    />
  )
}
