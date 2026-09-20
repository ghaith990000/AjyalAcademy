import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/dates'
import {
  createRegisterSchema,
  emptyChild,
  MAX_CHILDREN,
  toChildInput,
  type ChildFormValues,
  type RegisterFormValues,
} from './schema'

const child = (overrides: Partial<ChildFormValues> = {}): ChildFormValues => ({
  ...emptyChild(),
  full_name: 'Yousef Al Mahmood',
  cpr: '150312345',
  date_of_birth: '2015-03-12',
  ...overrides,
})

const valid: RegisterFormValues = {
  guardian_name: 'Mona Al Mahmood',
  phone: '3900 1234',
  location_id: 'loc-1',
  children: [child()],
  confirm: true,
  website: '',
}

const schema = createRegisterSchema({ locationRequired: true })

/** The message key reported for each failing path, as `children.0.cpr`. */
function issues(values: Partial<RegisterFormValues>, s = schema): Record<string, string> {
  const result = s.safeParse({ ...valid, ...values })
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('registration schema', () => {
  it('accepts a complete request', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it('needs the parent’s name and phone', () => {
    expect(issues({ guardian_name: '   ' }).guardian_name).toBe('form.guardianName.required')
    expect(issues({ guardian_name: 'x'.repeat(121) }).guardian_name).toBe(
      'form.guardianName.tooLong',
    )
    expect(issues({ phone: '' }).phone).toBe('form.phone.required')
    expect(issues({ phone: '1234' }).phone).toBe('form.phone.invalid')
    expect(issues({ phone: '3900-1234' }).phone).toBe('form.phone.invalid')
  })

  it('accepts a phone number typed with spaces or a +973 prefix', () => {
    expect(issues({ phone: '+973 3900 1234' })).toEqual({})
    expect(issues({ phone: '3900 1234' })).toEqual({})
  })

  it('needs a location only when the academy has some to offer', () => {
    expect(issues({ location_id: '' }).location_id).toBe('form.location.required')
    expect(issues({ location_id: '' }, createRegisterSchema({ locationRequired: false }))).toEqual(
      {},
    )
  })

  it('needs the confirmation', () => {
    expect(issues({ confirm: false }).confirm).toBe('form.confirm.required')
  })

  it('has one to four children', () => {
    expect(issues({ children: [] })['children']).toBeDefined()
    const four = Array.from({ length: MAX_CHILDREN }, (_, i) => child({ cpr: `15031234${i}` }))
    expect(issues({ children: four })).toEqual({})
    const five = [...four, child({ cpr: '150312349' })]
    expect(issues({ children: five })['children']).toBeDefined()
  })

  it('checks each child like a player: name, CPR, date of birth', () => {
    expect(issues({ children: [child({ full_name: ' ' })] })['children.0.full_name']).toBe(
      'form.fullName.required',
    )
    expect(issues({ children: [child({ cpr: '12345' })] })['children.0.cpr']).toBe(
      'form.cpr.invalid',
    )
    expect(issues({ children: [child({ cpr: '15031234a' })] })['children.0.cpr']).toBe(
      'form.cpr.invalid',
    )
    expect(issues({ children: [child({ date_of_birth: '' })] })['children.0.date_of_birth']).toBe(
      'form.dob.required',
    )
    expect(
      issues({ children: [child({ date_of_birth: '1985-01-01' })] })['children.0.date_of_birth'],
    ).toBe('form.dob.invalid')
    expect(
      issues({ children: [child({ date_of_birth: todayISO() })] })['children.0.date_of_birth'],
    ).toBe('form.dob.future')
  })

  it('needs a description when there is a condition', () => {
    expect(
      issues({ children: [child({ has_disease: true, disease_description: ' ' })] })[
        'children.0.disease_description'
      ],
    ).toBe('form.diseaseDescription.required')
    expect(
      issues({ children: [child({ has_disease: true, disease_description: 'Asthma' })] }),
    ).toEqual({})
  })

  it('points at the second card when two children share a CPR', () => {
    expect(issues({ children: [child(), child({ full_name: 'Noor' })] })).toEqual({
      'children.1.cpr': 'form.cpr.duplicate',
    })
  })

  it('does not judge the hidden field', () => {
    expect(issues({ website: 'http://spam.example' })).toEqual({})
  })
})

describe('toChildInput', () => {
  it('turns blanks into null and drops a description without a condition', () => {
    expect(toChildInput(child({ disease_description: 'left over' }))).toEqual({
      full_name: 'Yousef Al Mahmood',
      cpr: '150312345',
      date_of_birth: '2015-03-12',
      address: null,
      school: null,
      has_disease: false,
      disease_description: null,
    })
  })

  it('keeps what was filled in', () => {
    expect(
      toChildInput(
        child({
          school: 'Al Rifa',
          address: 'Block 9',
          has_disease: true,
          disease_description: 'Asthma',
        }),
      ),
    ).toMatchObject({
      school: 'Al Rifa',
      address: 'Block 9',
      has_disease: true,
      disease_description: 'Asthma',
    })
  })
})
