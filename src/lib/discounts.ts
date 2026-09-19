import { formatBHD } from './money'

/** Parse a typed percentage ("10", "12.5", "12,25") into basis points (10% = 1000), or null if invalid. */
export function parsePercentToBps(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null
  const [whole = '0', fraction = ''] = text.split('.')
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return bps >= 1 && bps <= 10_000 ? bps : null
}

/** 1000 → "10%", 1250 → "12.5%", 1225 → "12.25%". */
export function formatPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`
}

/** Basis points as the text a user would type, for editing: 1250 → "12.5". */
export function percentInputValue(bps: number): string {
  return String(Number((bps / 100).toFixed(2)))
}

/** A discount as shown to people: "10%" for percent, "5.000 BD" for fixed. */
export function formatDiscountValue(
  type: 'percent' | 'fixed',
  value: number,
  language: 'ar' | 'en',
): string {
  return type === 'percent' ? formatPercent(value) : formatBHD(value, language)
}
