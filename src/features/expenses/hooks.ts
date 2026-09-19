import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createExpense,
  deleteExpense,
  generateMonthlySalaries,
  listExpenses,
  updateExpense,
  type ExpenseFilters,
} from './api'
import type { ExpenseInput } from './schema'

const KEY = ['expenses'] as const

export function useExpensesList(filters: ExpenseFilters) {
  const query = useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: ({ pageParam }) => listExpenses(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? pages.length : undefined
    },
    placeholderData: keepPreviousData,
    meta: { silent: true }, // ExpensesPage renders its own load-error state
  })
  return {
    ...query,
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  }
}

/** Any change to an expense moves the reports too. */
function useInvalidateMoney() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: KEY }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ])
}

export function useCreateExpense() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    meta: { silent: true }, // the form reports the failure itself
    onSuccess: invalidate,
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseInput }) => updateExpense(id, input),
    meta: { silent: true },
    onSuccess: invalidate,
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    meta: { silent: true },
    onSuccess: invalidate,
  })
}

export function useGenerateSalaries() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (month: string) => generateMonthlySalaries(month),
    meta: { silent: true }, // the dialog reports the failure itself
    onSuccess: invalidate,
  })
}
