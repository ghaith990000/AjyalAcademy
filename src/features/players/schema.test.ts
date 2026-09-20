import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/dates'
import { playerSchema, toPlayerInput, type PlayerFormValues } from './schema'

const valid: PlayerFormValues = {
  full_name: 'Yousef Al Mahmood',
  cpr: '150312345',
  date_of_birth: '2015-03-12',
  address: '',
  school: '',
  phone: '39111001',
  guardian_name: '',
  has_disease: false,
  disease_description: '',
  coach_id: '',
  location_id: '',
}

/** The message key reported for each failing field. */
function issues(values: Partial<PlayerFormValues>): Record<string, string> {
  const result = playerSchema.safeParse({ ...valid, ...values })
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('playerSchema', () => {
  it('accepts a complete player', () => {
    expect(playerSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a name', () => {
    expect(issues({ full_name: '   ' }).full_name).toBe('form.fullName.required')
    expect(issues({ full_name: 'x'.repeat(121) }).full_name).toBe('form.fullName.tooLong')
  })

  it.each(['12345678', '1234567890', '12345678a', '12 345 678', '١٢٣٤٥٦٧٨٩', ''])(
    'rejects the CPR "%s"',
    (cpr) => {
      expect(issues({ cpr }).cpr).toBe('form.cpr.invalid')
    },
  )

  it('trims the CPR before checking it', () => {
    expect(issues({ cpr: ' 150312345 ' })).toEqual({})
  })

  describe('date of birth', () => {
    it('is required and must be a real date', () => {
      expect(issues({ date_of_birth: '' }).date_of_birth).toBe('form.dob.required')
      expect(issues({ date_of_birth: '2015-02-31' }).date_of_birth).toBe('form.dob.invalid')
      expect(issues({ date_of_birth: '1850-01-01' }).date_of_birth).toBe('form.dob.invalid')
    })

    it('must be in the past — today and later are refused', () => {
      expect(issues({ date_of_birth: todayISO() }).date_of_birth).toBe('form.dob.future')
      expect(issues({ date_of_birth: '2999-01-01' }).date_of_birth).toBe('form.dob.future')
    })
  })

  describe('phone', () => {
    it.each(['39111001', '+97339111001', '3911 1001', '+973 3911 1001'])('accepts %s', (phone) => {
      expect(issues({ phone })).toEqual({})
    })

    it('is required and must look like a phone number', () => {
      expect(issues({ phone: '' }).phone).toBe('form.phone.required')
      expect(issues({ phone: '1234' }).phone).toBe('form.phone.invalid')
      expect(issues({ phone: '39111abc' }).phone).toBe('form.phone.invalid')
    })
  })

  describe('medical condition', () => {
    it('needs a description when the player has one', () => {
      expect(issues({ has_disease: true, disease_description: '' }).disease_description).toBe(
        'form.diseaseDescription.required',
      )
      expect(issues({ has_disease: true, disease_description: '   ' }).disease_description).toBe(
        'form.diseaseDescription.required',
      )
    })

    it('accepts a described condition, and needs nothing when there is none', () => {
      expect(issues({ has_disease: true, disease_description: 'Asthma' })).toEqual({})
      expect(issues({ has_disease: false, disease_description: '' })).toEqual({})
    })

    it('limits the description length', () => {
      expect(
        issues({ has_disease: true, disease_description: 'x'.repeat(501) }).disease_description,
      ).toBe('form.diseaseDescription.tooLong')
    })
  })
})

describe('guardian name', () => {
  it('is optional', () => {
    expect(playerSchema.safeParse({ ...valid, guardian_name: '' }).success).toBe(true)
  })

  it('is at most 120 characters', () => {
    expect(issues({ guardian_name: 'x'.repeat(121) }).guardian_name).toBe(
      'form.guardianName.tooLong',
    )
  })
})

describe('toPlayerInput', () => {
  it('turns blank optional fields into null', () => {
    expect(toPlayerInput(valid, { includeCoach: false })).toEqual({
      full_name: 'Yousef Al Mahmood',
      cpr: '150312345',
      date_of_birth: '2015-03-12',
      address: null,
      school: null,
      phone: '39111001',
      guardian_name: null,
      has_disease: false,
      disease_description: null,
      location_id: null,
    })
  })

  it("keeps the parent's name (trimmed by the schema), or null when blank", () => {
    const parsed = playerSchema.parse({ ...valid, guardian_name: '  Mona Al Mahmood  ' })
    expect(toPlayerInput(parsed, { includeCoach: false }).guardian_name).toBe('Mona Al Mahmood')
    expect(toPlayerInput(valid, { includeCoach: false }).guardian_name).toBeNull()
  })

  it('sends the chosen location, or null for none', () => {
    expect(
      toPlayerInput({ ...valid, location_id: 'loc-1' }, { includeCoach: false }).location_id,
    ).toBe('loc-1')
    expect(toPlayerInput(valid, { includeCoach: false }).location_id).toBeNull()
  })

  it('drops a stale description when the condition switch is off', () => {
    const input = toPlayerInput(
      { ...valid, has_disease: false, disease_description: 'left over' },
      { includeCoach: false },
    )
    expect(input.disease_description).toBeNull()
  })

  it('keeps the description when there is a condition', () => {
    const input = toPlayerInput(
      { ...valid, has_disease: true, disease_description: 'Asthma' },
      { includeCoach: false },
    )
    expect(input.disease_description).toBe('Asthma')
  })

  it('only sends the coach when asked to, and maps "unassigned" to null', () => {
    expect(toPlayerInput({ ...valid, coach_id: 'c1' }, { includeCoach: false })).not.toHaveProperty(
      'coach_id',
    )
    expect(toPlayerInput({ ...valid, coach_id: 'c1' }, { includeCoach: true }).coach_id).toBe('c1')
    expect(toPlayerInput({ ...valid, coach_id: '' }, { includeCoach: true }).coach_id).toBeNull()
  })
})
