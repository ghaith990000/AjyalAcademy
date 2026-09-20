import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/lib/reports'
import {
  getExpensesByCategory,
  getReportByLocation,
  getReportSummary,
  getRevenueByMonth,
} from './api'

const KEY = ['reports'] as const

// Admin-only data. Every report screen renders its own load-error state, so the global handler stays quiet.
// `locationId` narrows a figure to one location; without it the figures cover the whole academy.
export function useReportSummary(range: DateRange, locationId?: string) {
  return useQuery({
    queryKey: [...KEY, 'summary', range, locationId ?? ''],
    queryFn: () => getReportSummary(range, locationId),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}

export function useRevenueByMonth(year: number, locationId?: string) {
  return useQuery({
    queryKey: [...KEY, 'months', year, locationId ?? ''],
    queryFn: () => getRevenueByMonth(year, locationId),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}

export function useExpensesByCategory(range: DateRange, locationId?: string) {
  return useQuery({
    queryKey: [...KEY, 'categories', range, locationId ?? ''],
    queryFn: () => getExpensesByCategory(range, locationId),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}

/** The period split by location (every location, plus the "no location" row). */
export function useReportByLocation(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'locations', range],
    queryFn: () => getReportByLocation(range),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  })
}
