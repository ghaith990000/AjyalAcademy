import { describe, expect, it } from 'vitest'
import type { ExpenseExportRow, PaymentExportRow } from './api'
import {
  buildExpensesCsv,
  buildPaymentsCsv,
  type ExpensesCsvLabels,
  type PaymentsCsvLabels,
} from './exportCsv'

const BOM = String.fromCharCode(0xfeff)

const paymentLabels: PaymentsCsvLabels = {
  headers: ['Date', 'Amount (BD)', 'Method', 'Players', 'Plan', 'Location', 'Note', 'Received by'],
  method: (method) =>
    ({ cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank', other: 'Other' })[method],
  plan: (code) => code.toUpperCase(),
}
const expenseLabels: ExpensesCsvLabels = {
  headers: ['Date', 'Category', 'Amount (BD)', 'Location', 'Coach', 'Note'],
  category: (category) => `cat:${category}`,
}

const payment = (overrides: Partial<PaymentExportRow> = {}): PaymentExportRow => ({
  paid_at: '2026-10-01',
  amount_fils: 200_000,
  method: 'cash',
  note: null,
  received_by: { full_name: 'Demo Admin' },
  subscription: {
    plan: { code: 'duo' },
    location: { name: 'Al-Rifa' },
    subscription_players: [
      { player: { full_name: 'Ali Hassan' } },
      { player: { full_name: 'Omar Hassan' } },
    ],
  },
  ...overrides,
})

describe('buildPaymentsCsv', () => {
  it('starts with the byte-order mark and the translated header row', () => {
    const csv = buildPaymentsCsv([], paymentLabels)
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(1)).toBe('Date,Amount (BD),Method,Players,Plan,Location,Note,Received by\r\n')
  })

  it('writes one row per payment: ISO date, plain BD amount, players joined, plan, receiver', () => {
    const csv = buildPaymentsCsv([payment()], paymentLabels)
    expect(csv.split('\r\n')[1]).toBe(
      '2026-10-01,200.000,Cash,Ali Hassan; Omar Hassan,DUO,Al-Rifa,,Demo Admin',
    )
  })

  it('keeps Arabic names intact', () => {
    const csv = buildPaymentsCsv(
      [
        payment({
          subscription: {
            plan: { code: 'solo' },
            location: { name: 'ملعب حديقة الرفاع' },
            subscription_players: [{ player: { full_name: 'محمد علي' } }],
          },
        }),
      ],
      paymentLabels,
    )
    expect(csv).toContain('محمد علي')
    expect(csv).toContain('ملعب حديقة الرفاع')
  })

  it('copes with a payment whose subscription, plan, players or receiver are not readable', () => {
    const csv = buildPaymentsCsv(
      [payment({ subscription: null, received_by: null, method: 'benefit' })],
      paymentLabels,
    )
    expect(csv.split('\r\n')[1]).toBe('2026-10-01,200.000,Benefit,,,,,')
  })

  it('does not let a note run as a spreadsheet formula, and quotes commas', () => {
    const csv = buildPaymentsCsv(
      [payment({ note: '=1+1' }), payment({ note: 'Ref 12, paid twice' })],
      paymentLabels,
    )
    const rows = csv.split('\r\n')
    expect(rows[1]).toContain(",'=1+1,")
    expect(rows[2]).toContain(',"Ref 12, paid twice",')
  })
})

describe('buildExpensesCsv', () => {
  const expense = (overrides: Partial<ExpenseExportRow> = {}): ExpenseExportRow => ({
    expense_date: '2026-10-15',
    category: 'field_rent',
    amount_fils: 50_000,
    description: 'Pitch, hall A',
    coach: null,
    location: { name: 'Al-Rifa' },
    ...overrides,
  })

  it('writes the header and one row per expense', () => {
    const csv = buildExpensesCsv(
      [
        expense(),
        expense({
          category: 'coach_salary',
          amount_fils: 150_000,
          description: null,
          coach: { full_name: 'Khalid' },
          location: null,
        }),
      ],
      expenseLabels,
    )
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Date,Category,Amount (BD),Location,Coach,Note',
      '2026-10-15,cat:field_rent,50.000,Al-Rifa,,"Pitch, hall A"',
      '2026-10-15,cat:coach_salary,150.000,,Khalid,',
      '',
    ])
  })
})
