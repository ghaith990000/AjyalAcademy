import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDiscount, listDiscounts, updateDiscount, type DiscountInput } from './api'

const DISCOUNTS_KEY = ['discounts'] as const

export function useDiscounts() {
  return useQuery({
    queryKey: DISCOUNTS_KEY,
    queryFn: listDiscounts,
    meta: { silent: true }, // DiscountsPage renders its own load-error state
  })
}

export function useCreateDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DiscountInput) => createDiscount(input),
    meta: { silent: true }, // the form reports a duplicate code itself
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY }),
  })
}

export function useUpdateDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DiscountInput }) => updateDiscount(id, input),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY }),
  })
}
