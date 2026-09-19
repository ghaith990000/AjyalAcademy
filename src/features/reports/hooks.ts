import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/lib/reports'
import { getExpensesByCategory, getReportSummary, getRevenueByMonth } from './api'

const KEY = ['reports'] as const

// Admin-only data. Every report screen renders its own load-error state, so the global handler stays quiet.
export function useReportSummary(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'summary', range],
    queryFn: () => getReportSummary(range),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}

export function useRevenueByMonth(year: number) {
  return useQuery({
    queryKey: [...KEY, 'months', year],
    queryFn: () => getRevenueByMonth(year),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}

export function useExpensesByCategory(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'categories', range],
    queryFn: () => getExpensesByCategory(range),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}
