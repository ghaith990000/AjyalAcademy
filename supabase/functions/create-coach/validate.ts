// Pure input validation for the create-coach function (no Deno APIs, so it is unit-tested in Node).

export interface CreateCoachInput {
  full_name: string
  email: string
  password: string
  phone: string | null
  monthly_salary_fils: number
  preferred_language: 'ar' | 'en'
}

export type ValidationResult = { ok: true; value: CreateCoachInput } | { ok: false; field: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateCreateCoach(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, field: 'body' }
  const b = body as Record<string, unknown>

  const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : ''
  if (fullName.length === 0 || fullName.length > 120) return { ok: false, field: 'full_name' }

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, field: 'email' }

  const password = typeof b.password === 'string' ? b.password : ''
  if (password.length < 8 || password.length > 72) return { ok: false, field: 'password' }

  let phone: string | null = null
  if (b.phone !== undefined && b.phone !== null && b.phone !== '') {
    if (typeof b.phone !== 'string' || b.phone.trim().length > 30)
      return { ok: false, field: 'phone' }
    phone = b.phone.trim()
  }

  const salary = b.monthly_salary_fils ?? 0
  if (
    typeof salary !== 'number' ||
    !Number.isInteger(salary) ||
    salary < 0 ||
    salary > 10_000_000
  ) {
    return { ok: false, field: 'monthly_salary_fils' }
  }

  const language = b.preferred_language ?? 'ar'
  if (language !== 'ar' && language !== 'en') return { ok: false, field: 'preferred_language' }

  return {
    ok: true,
    value: {
      full_name: fullName,
      email,
      password,
      phone,
      monthly_salary_fils: salary,
      preferred_language: language,
    },
  }
}
