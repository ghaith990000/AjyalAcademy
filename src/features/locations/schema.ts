import { z } from 'zod'
import type { LocationInput } from './api'

// Messages are `locations` namespace keys, translated where they are rendered.
export const locationSchema = z.object({
  name: z.string().trim().min(1, 'form.name.required').max(120, 'form.name.tooLong'),
  address: z.string().trim().max(200, 'form.address.tooLong'),
  active: z.boolean(),
})

export type LocationFormValues = z.infer<typeof locationSchema>

export function toLocationInput(values: LocationFormValues): LocationInput {
  return {
    name: values.name,
    address: values.address === '' ? null : values.address,
    active: values.active,
  }
}
