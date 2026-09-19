import { z } from 'zod'
import { parseBD } from '@/lib/money'

const MAX_FILS = 1_000_000 // 1,000 BD — a sanity ceiling, far above any plan or fee

// Messages are `settings` namespace keys, translated where they are rendered.
const bd = z
  .string()
  .trim()
  .refine((value) => parseBD(value) !== null, 'invalidAmount')
  .refine((value) => (parseBD(value) ?? 0) <= MAX_FILS, 'tooHigh')

export const settingsSchema = z.object({
  solo: bd,
  duo: bd,
  trio: bd,
  quad: bd,
  tshirt: bd,
  transport: bd,
  expiringDays: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, 'invalidDays'),
})

export type SettingsValues = z.infer<typeof settingsSchema>
