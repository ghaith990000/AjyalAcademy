import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { ACTIVITY_PAGE_SIZE, listActivity } from './api'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

/** A query builder that records what was asked and resolves to the given rows. */
function fakeQuery(rows: unknown[], error: unknown = null) {
  const calls: Record<string, unknown[][]> = {}
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => void) => resolve({ data: rows, error }),
  }
  for (const method of ['select', 'order', 'limit', 'in', 'or']) {
    builder[method] = (...args: unknown[]) => {
      ;(calls[method] ??= []).push(args)
      return builder
    }
  }
  vi.mocked(supabase.from).mockReturnValue(builder as never)
  return calls
}

const row = (n: number) => ({
  id: `id-${n}`,
  created_at: `2026-10-19T10:00:${String(n).padStart(2, '0')}.123456+00:00`,
})

describe('listActivity', () => {
  beforeEach(() => vi.resetAllMocks())

  it('asks for the newest first, with the id as tie-break, and one row more than a page', async () => {
    const calls = fakeQuery([])
    await listActivity('all', null)
    expect(supabase.from).toHaveBeenCalledWith('activity_log')
    expect(calls.order).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(calls.limit).toEqual([[ACTIVITY_PAGE_SIZE + 1]])
    expect(calls.in).toBeUndefined()
    expect(calls.or).toBeUndefined()
  })

  it('narrows to the entity types behind a chip', async () => {
    const calls = fakeQuery([])
    await listActivity('session', null)
    expect(calls.in).toEqual([['entity_type', ['session', 'attendance']]])
  })

  it('continues after a cursor: older, or the same moment with a smaller id', async () => {
    const calls = fakeQuery([])
    await listActivity('all', { createdAt: '2026-10-19T10:00:05.123456+00:00', id: 'id-5' })
    expect(calls.or).toEqual([
      [
        'created_at.lt.2026-10-19T10:00:05.123456+00:00,and(created_at.eq.2026-10-19T10:00:05.123456+00:00,id.lt.id-5)',
      ],
    ])
  })

  it('has no next page when the extra row is missing', async () => {
    fakeQuery([row(3), row(2), row(1)])
    const result = await listActivity('all', null)
    expect(result.rows).toHaveLength(3)
    expect(result.next).toBeNull()
  })

  it('returns a page and a cursor pointing at its last row when there is more', async () => {
    fakeQuery(Array.from({ length: ACTIVITY_PAGE_SIZE + 1 }, (_, i) => row(ACTIVITY_PAGE_SIZE - i)))
    const result = await listActivity('all', null)
    expect(result.rows).toHaveLength(ACTIVITY_PAGE_SIZE)
    const last = result.rows.at(-1)!
    expect(result.next).toEqual({ createdAt: last.created_at, id: last.id })
  })

  it('throws what the server said', async () => {
    fakeQuery([], { code: '42501', message: 'denied' })
    await expect(listActivity('all', null)).rejects.toMatchObject({ code: '42501' })
  })
})
