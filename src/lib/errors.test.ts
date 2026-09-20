import { describe, expect, it } from 'vitest'
import { ajyalCodeOf, errorDetailOf, errorKeyOf } from './errors'

describe('errorKeyOf', () => {
  it('recognises connection problems', () => {
    expect(errorKeyOf(new TypeError('Failed to fetch'))).toBe('network')
    expect(errorKeyOf({ name: 'AuthRetryableFetchError', message: 'x' })).toBe('network')
    expect(errorKeyOf({ name: 'FunctionsFetchError', message: 'x' })).toBe('network')
  })

  it('recognises a failed fetch that supabase-js returns as an error object instead of throwing', () => {
    // postgrest-js: `${error.name}: ${error.message}`, with no status and no code
    for (const message of [
      'TypeError: Failed to fetch', // Chrome
      'TypeError: Load failed', // Safari
      'TypeError: NetworkError when attempting to fetch resource.', // Firefox
      'FetchError: request to https://x.supabase.co failed',
    ]) {
      expect(errorKeyOf({ message, details: '', hint: '', code: '' })).toBe('network')
    }
    // ...but not a database error that merely mentions one
    expect(errorKeyOf({ message: 'invalid input: TypeError', code: '22P02' })).toBe('generic')
  })

  it('recognises permission errors (Postgres RLS / privileges and our own codes)', () => {
    expect(errorKeyOf({ code: '42501', message: 'permission denied' })).toBe('forbidden')
    expect(errorKeyOf({ status: 403, message: 'no' })).toBe('forbidden')
    expect(errorKeyOf({ message: 'ajyal:forbidden_profile_change' })).toBe('forbidden')
  })

  it('recognises an expired session', () => {
    expect(errorKeyOf({ code: 'PGRST301', message: 'JWT expired' })).toBe('session')
    expect(errorKeyOf({ status: 401, message: 'no' })).toBe('session')
  })

  it('falls back to a generic message and never leaks raw text', () => {
    expect(errorKeyOf(new Error('duplicate key value violates unique constraint'))).toBe('generic')
    expect(errorKeyOf(null)).toBe('generic')
    expect(errorKeyOf('boom')).toBe('generic')
  })
})

describe('ajyalCodeOf / errorDetailOf', () => {
  it('extracts the code of our own SQL errors', () => {
    expect(ajyalCodeOf({ message: 'ajyal:overlap', code: '23P01' })).toBe('overlap')
    expect(ajyalCodeOf({ message: 'ajyal:manual_discount_reason_required' })).toBe(
      'manual_discount_reason_required',
    )
  })

  it('returns null for anything else', () => {
    expect(ajyalCodeOf({ message: 'duplicate key value' })).toBeNull()
    expect(ajyalCodeOf(new Error('boom'))).toBeNull()
    expect(ajyalCodeOf(null)).toBeNull()
    expect(ajyalCodeOf({ message: 42 })).toBeNull()
  })

  it('reads the DETAIL text when there is one', () => {
    expect(errorDetailOf({ details: 'id-1,id-2' })).toBe('id-1,id-2')
    expect(errorDetailOf({ details: '' })).toBeNull()
    expect(errorDetailOf({})).toBeNull()
  })
})
