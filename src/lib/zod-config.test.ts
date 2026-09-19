import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import './zod-config'

describe('zod configuration', () => {
  it('does not build validators with new Function (the Content-Security-Policy forbids eval)', () => {
    expect(z.core.globalConfig.jitless).toBe(true)
  })

  it('still validates', () => {
    const schema = z.object({ name: z.string().min(1) })
    expect(schema.safeParse({ name: 'Ali' }).success).toBe(true)
    expect(schema.safeParse({ name: '' }).success).toBe(false)
  })
})
