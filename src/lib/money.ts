/**
 * Money helpers. All amounts are integer FILS (1 BD = 1000 fils). Never store or sum floats.
 * See docs/05-business-rules.md.
 */

export const FILS_PER_BD = 1000

/** Convert a BD amount typed by a user (e.g. 12.5 or "12.500") to integer fils. */
export function fromBD(bd: number | string): number {
  const value = typeof bd === 'string' ? Number(bd.replace(',', '.')) : bd
  if (!Number.isFinite(value)) throw new Error(`Invalid BD amount: ${bd}`)
  return Math.round(value * FILS_PER_BD)
}

/** Convert integer fils to a BD number (for display/inputs only, never for arithmetic). */
export function toBD(fils: number): number {
  return fils / FILS_PER_BD
}

/** "20.000" — Latin digits, always 3 decimals (Bahraini convention), in every language. */
export function formatBDAmount(fils: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(toBD(fils))
}

/** "BD" / "د.ب" */
export function currencyLabel(language: 'ar' | 'en'): string {
  return language === 'ar' ? 'د.ب' : 'BD'
}

/** "20.000 BD" / "20.000 د.ب". Wrap the result in <bdi> when rendering inside RTL text. */
export function formatBHD(fils: number, language: 'ar' | 'en'): string {
  return `${formatBDAmount(fils)} ${currencyLabel(language)}`
}

/**
 * Parse a BD amount typed by a user into integer fils, or `null` if it is not a valid amount.
 * Accepts "12", "12.5", "12,500" (comma as decimal mark), up to 3 decimals; no signs, no thousands separators.
 */
export function parseBD(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null
  const [whole = '0', fraction = ''] = text.split('.')
  return Number(whole) * FILS_PER_BD + Number(fraction.padEnd(3, '0'))
}
