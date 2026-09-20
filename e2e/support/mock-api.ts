/**
 * A small in-memory stand-in for the Supabase project: auth, the tables and functions the app reads and writes,
 * and the Realtime socket. It speaks the real wire formats (PostgREST filters, phoenix v2 frames) so the built
 * app runs against it unchanged. Anything it does not know is recorded in `world.unmatched`, and the audit
 * spec fails on it — a new query in the app has to be taught to this mock.
 */
import type { Page, Route } from '@playwright/test'

export const SUPABASE_URL = 'https://e2e.supabase.test'
export const STORAGE_KEY = 'sb-e2e-auth-token'
export const PASSWORD = 'correct-password'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const plusDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const TODAY = plusDays(0)
const stamp = (minsAgo: number) =>
  new Date(Date.now() - minsAgo * 60_000).toISOString().replace('Z', '+00:00')

// ---------------------------------------------------------------------------------------------------------
// The people
// ---------------------------------------------------------------------------------------------------------
export interface Person {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'coach'
  active: boolean
  monthly_salary_fils: number
}
export const ADMIN: Person = {
  id: 'a-1',
  full_name: 'Demo Admin',
  email: 'admin@ajyal.test',
  role: 'admin',
  active: true,
  monthly_salary_fils: 0,
}
export const COACH: Person = {
  id: 'c-1',
  full_name: 'Khalid Al Dosari',
  email: 'coach@ajyal.test',
  role: 'coach',
  active: true,
  monthly_salary_fils: 150_000,
}
export const COACH2: Person = {
  id: 'c-2',
  full_name: 'سارة آل خليفة',
  email: 'sara@ajyal.test',
  role: 'coach',
  active: true,
  monthly_salary_fils: 100_000,
}
export const RETIRED: Person = {
  id: 'c-3',
  full_name: 'Retired Coach',
  email: 'old@ajyal.test',
  role: 'coach',
  active: false,
  monthly_salary_fils: 0,
}
const PEOPLE = [ADMIN, COACH, COACH2, RETIRED]

type Row = Record<string, unknown>
export interface Call {
  method: string
  path: string
  search: string
  body: unknown
}

const profileRow = (p: Person, lang: string): Row => ({
  ...p,
  phone: null,
  created_at: '2026-01-01T00:00:00Z',
  preferred_language: lang,
})

function jwtFor(person: Person, expSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: person.id, exp: expSeconds, role: 'authenticated' }),
  ).toString('base64url')
  return `e30.${payload}.sig`
}

export function sessionFor(person: Person) {
  const exp = Math.floor(Date.now() / 1000) + 86_400
  return {
    access_token: jwtFor(person, exp),
    token_type: 'bearer',
    expires_in: 86_400,
    expires_at: exp,
    refresh_token: 'refresh',
    user: {
      id: person.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: person.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

// ---------------------------------------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------------------------------------
let seq = 0
const uid = (prefix: string) => `${prefix}-${++seq}`

/** The academy's locations: an Arabic and a Latin name (both directions on one screen), and one switched off. */
const LOC = {
  rifa: { id: 'loc-1', name: 'ملعب حديقة الرفاع' },
  hamad: { id: 'loc-2', name: 'Hamad City Field' },
} as const

function seedWorld() {
  const locations: Row[] = [
    { ...LOC.rifa, address: 'الرفاع', active: true, created_at: '2026-01-01T00:00:00Z' },
    { ...LOC.hamad, address: null, active: true, created_at: '2026-01-02T00:00:00Z' },
    {
      id: 'loc-3',
      name: 'Old Field',
      address: null,
      active: false,
      created_at: '2025-01-01T00:00:00Z',
    },
  ]
  const coachOf = (id: string | null) =>
    id ? { full_name: PEOPLE.find((p) => p.id === id)!.full_name } : null
  const mkPlayer = (
    id: string,
    full_name: string,
    coach_id: string | null,
    extra: Row = {},
  ): Row => ({
    id,
    full_name,
    cpr: `15031234${id.slice(-1)}`,
    date_of_birth: '2015-03-12',
    address: 'Riffa',
    school: 'Al Noor School',
    phone: '39111001',
    has_disease: false,
    disease_description: null,
    coach_id,
    location_id: LOC.rifa.id,
    created_by: coach_id,
    created_at: '2026-06-01T08:00:00Z',
    deleted_at: null,
    deleted_by: null,
    coach: coachOf(coach_id),
    location: { name: LOC.rifa.name },
    ...extra,
  })
  const players = [
    mkPlayer('p1', 'Ali Hassan', 'c-1'),
    mkPlayer('p2', 'حمد سلمان', 'c-1'),
    mkPlayer('p3', 'يوسف عبدالله المحمود الخليفة الطويل جداً', 'c-1', {
      has_disease: true,
      disease_description: 'Asthma — carries an inhaler',
    }),
    mkPlayer('p4', 'Mohammed Abdulrahman Al Khalifa Al Mahmood', 'c-1'),
    mkPlayer('p5', 'Zayed Nasser', 'c-1'),
    mkPlayer('p6', 'ناصر بن راشد', 'c-1'),
    mkPlayer('p7', 'Omar Faisal', 'c-2'),
    mkPlayer('p8', 'Bader Khaled', null),
  ]

  const sub = (
    id: string,
    names: string,
    ids: string[],
    plan: string,
    start: string,
    end: string,
    total: number,
    paid: number,
    status: string,
    extra: Row = {},
  ): Row => ({
    id,
    plan_id: `plan-${plan}`,
    plan_code: plan,
    start_date: start,
    end_date: end,
    plan_price_fils: total,
    tshirt_total_fils: 0,
    transport_total_fils: 0,
    discount_id: null,
    discount_type: null,
    discount_value: null,
    discount_reason: null,
    discount_fils: 0,
    total_fils: total,
    cancelled_at: null,
    cancel_reason: null,
    created_at: '2026-09-01T08:00:00Z',
    paid_fils: paid,
    balance_fils: total - paid,
    status,
    player_names: names,
    player_count: ids.length,
    location_id: LOC.rifa.id,
    location_name: LOC.rifa.name,
    _players: ids,
    ...extra,
  })
  const subscriptions = [
    sub('s1', 'Ali Hassan', ['p1'], 'solo', plusDays(-20), plusDays(10), 20_000, 20_000, 'active'),
    sub(
      's2',
      'حمد سلمان',
      ['p2'],
      'solo',
      plusDays(-27),
      plusDays(2),
      20_000,
      5_000,
      'expiring_soon',
    ),
    sub(
      's3',
      'Zayed Nasser, Omar Faisal',
      ['p5', 'p7'],
      'duo',
      plusDays(-60),
      plusDays(-31),
      35_000,
      35_000,
      'expired',
    ),
    sub('s4', 'ناصر بن راشد', ['p6'], 'solo', plusDays(-10), plusDays(20), 20_000, 0, 'cancelled', {
      cancelled_at: stamp(600),
      cancel_reason: 'Moved away',
    }),
  ]

  const payments: Row[] = [
    {
      id: 'pay1',
      subscription_id: 's1',
      amount_fils: 20_000,
      paid_at: plusDays(-20),
      method: 'cash',
      note: null,
      created_at: '2026-09-01T09:00:00Z',
      received: { full_name: 'Demo Admin' },
    },
    {
      id: 'pay2',
      subscription_id: 's2',
      amount_fils: 5_000,
      paid_at: plusDays(-27),
      method: 'benefit',
      note: 'Ref 1',
      created_at: '2026-09-01T09:00:00Z',
      received: { full_name: 'Khalid Al Dosari' },
    },
    {
      id: 'pay3',
      subscription_id: 's3',
      amount_fils: 35_000,
      paid_at: plusDays(-60),
      method: 'bank_transfer',
      note: null,
      created_at: '2026-07-01T09:00:00Z',
      received: { full_name: 'Demo Admin' },
    },
  ]

  const mkSession = (
    id: string,
    date: string,
    start: string,
    end: string,
    coach_id: string,
    location: { id: string; name: string },
    cancelled = false,
  ): Row => ({
    id,
    session_date: date,
    start_time: start,
    end_time: end,
    coach_id,
    location_id: location.id,
    location: { name: location.name },
    notes: null,
    cancelled_at: cancelled ? stamp(300) : null,
    created_by: null,
    created_at: '2026-09-01T08:00:00Z',
    coach: coachOf(coach_id),
  })
  const sessions = [
    mkSession('se1', TODAY, '00:10:00', '00:20:00', 'c-1', LOC.rifa),
    mkSession('se2', TODAY, '16:00:00', '17:30:00', 'c-1', LOC.hamad),
    mkSession('se3', plusDays(1), '16:00:00', '17:30:00', 'c-1', LOC.hamad),
    mkSession('se4', plusDays(1), '18:00:00', '19:00:00', 'c-2', LOC.rifa),
    mkSession('se5', plusDays(-3), '16:00:00', '17:30:00', 'c-1', LOC.hamad),
    mkSession('se6', plusDays(-2), '16:00:00', '17:30:00', 'c-1', LOC.hamad, true),
  ]
  const attendance: Row[] = [
    {
      session_id: 'se5',
      player_id: 'p1',
      status: 'present',
      marked_at: stamp(4000),
      player: { id: 'p1', full_name: 'Ali Hassan' },
    },
    {
      session_id: 'se5',
      player_id: 'p2',
      status: 'absent',
      marked_at: stamp(4000),
      player: { id: 'p2', full_name: 'حمد سلمان' },
    },
  ]

  const expenses: Row[] = [
    {
      id: 'e1',
      category: 'field_rent',
      amount_fils: 50_000,
      expense_date: plusDays(-5),
      coach_id: null,
      description: 'Pitch, hall A',
      created_by: 'a-1',
      created_at: '2026-09-01T08:00:00Z',
      location_id: LOC.rifa.id,
      coach: null,
      location: { name: LOC.rifa.name },
    },
    {
      id: 'e2',
      category: 'coach_salary',
      amount_fils: 150_000,
      expense_date: plusDays(-9),
      coach_id: 'c-1',
      description: null,
      created_by: 'a-1',
      created_at: '2026-09-01T08:00:00Z',
      location_id: null,
      coach: { full_name: 'Khalid Al Dosari' },
      location: null,
    },
  ]
  const discounts: Row[] = [
    {
      id: 'd1',
      name: 'Sibling discount',
      code: 'SIBLING10',
      type: 'percent',
      value: 1250,
      valid_from: null,
      valid_to: null,
      max_uses: null,
      active: true,
      created_by: null,
      created_at: '2026-01-01T00:00:00Z',
      subscriptions: [{ count: 2 }],
    },
  ]

  let actSeq = 0
  const act = (action: string, actor: Person, minsAgo: number, summary: Row): Row => ({
    id: `00000000-0000-0000-0000-${String(1000 + ++actSeq).padStart(12, '0')}`,
    actor_id: actor.id,
    action,
    entity_type: action.split('.')[0],
    entity_id: null,
    summary: { actor_name: actor.full_name, ...summary },
    created_at: stamp(minsAgo),
  })
  const activity = [
    act('player.created', COACH, 3, {
      player_name: 'يوسف عبدالله المحمود الخليفة الطويل جداً',
      coach_name: 'Khalid Al Dosari',
    }),
    act('payment.recorded', COACH, 50, {
      player_names: ['Ali Hassan'],
      amount_fils: 20_000,
      balance_fils: 0,
    }),
    act('subscription.created', ADMIN, 120, {
      player_names: ['Ali Hassan'],
      plan: 'solo',
      total_fils: 20_000,
      discount_fils: 0,
    }),
    act('attendance.saved', COACH, 300, {
      session_date: plusDays(-3),
      start_time: '16:00:00',
      coach_name: 'Khalid Al Dosari',
      present_count: 1,
      total_count: 2,
    }),
    act('expense.created', ADMIN, 700, { category: 'field_rent', amount_fils: 50_000 }),
  ]

  // Registration requests from parents (what the public form stores): waiting, accepted and rejected.
  const app = (id: string, extra: Row): Row => ({
    id,
    submission_id: `sub-${id}`,
    guardian_name: 'منى المحمود',
    phone: '39001234',
    language: 'ar',
    location_id: LOC.rifa.id,
    location_name: LOC.rifa.name,
    full_name: 'نور المحمود',
    cpr: '160312345',
    date_of_birth: '2015-05-05',
    address: 'الرفاع، مجمع 901',
    school: 'مدرسة النور',
    has_disease: false,
    disease_description: null,
    status: 'pending',
    created_at: stamp(90),
    decided_at: null,
    decided_by_name: null,
    decision_note: null,
    player_id: null,
    existing_player_id: null,
    existing_player_name: null,
    same_cpr_pending: 0,
    ...extra,
  })
  const applications: Row[] = [
    // the CPR of a player who already exists, and another waiting request has it too: both warnings at once
    app('ap1', {
      full_name: 'Ali Hassan',
      guardian_name: 'Hassan Ali Al Mahmood',
      language: 'en',
      cpr: '150312341',
      existing_player_id: 'p1',
      existing_player_name: 'Ali Hassan',
      same_cpr_pending: 1,
      created_at: stamp(30),
    }),
    app('ap2', {
      full_name: 'Mohammed Abdulrahman Al Khalifa Al Mahmood Al Sayed',
      guardian_name: 'عبدالرحمن بن محمد بن خليفة آل خليفة',
      cpr: '160312346',
      location_id: null,
      location_name: null,
      created_at: stamp(300),
    }),
    app('ap3', {
      full_name: 'سلمان العلي',
      cpr: '160312347',
      has_disease: true,
      disease_description: 'ربو — يحمل بخاخاً',
      created_at: stamp(1500),
    }),
    app('ap4', {
      full_name: 'حمد الأحمد',
      cpr: '160312348',
      status: 'accepted',
      decided_at: stamp(100),
      decided_by_name: 'Demo Admin',
      player_id: 'p2',
      created_at: stamp(2000),
    }),
    app('ap5', {
      full_name: 'Yousef Nasser',
      guardian_name: 'Nasser Al Ali',
      language: 'en',
      cpr: '160312349',
      status: 'rejected',
      decided_at: stamp(100),
      decided_by_name: 'Demo Admin',
      decision_note: 'No places left this season',
      created_at: stamp(2500),
    }),
  ]

  const plans: Row[] = [
    { id: 'plan-solo', code: 'solo', player_count: 1, price_fils: 20_000, active: true },
    { id: 'plan-duo', code: 'duo', player_count: 2, price_fils: 35_000, active: true },
    { id: 'plan-trio', code: 'trio', player_count: 3, price_fils: 50_000, active: true },
    { id: 'plan-quad', code: 'quad', player_count: 4, price_fils: 60_000, active: true },
  ]

  return {
    locations,
    players,
    subscriptions,
    payments,
    sessions,
    attendance,
    expenses,
    discounts,
    activity,
    applications,
    plans,
    settings: {
      id: true,
      tshirt_fee_fils: 5_000,
      transport_fee_fils: 10_000,
      expiring_soon_days: 7,
    },
    /** Every call the public form made to `submit_player_applications`, failed ones included. */
    submitAttempts: [] as Row[],
    /** Make the next submission fail: the connection drops, or the parent is turned away. */
    failNextSubmit: null as 'offline' | 'rate_limited' | null,
    unmatched: [] as string[],
    calls: [] as Call[],
  }
}
export type World = ReturnType<typeof seedWorld>

// ---------------------------------------------------------------------------------------------------------
// PostgREST-style filtering
// ---------------------------------------------------------------------------------------------------------
const RESERVED = new Set([
  'select',
  'order',
  'limit',
  'offset',
  'or',
  'and',
  'on_conflict',
  'columns',
])

function compare(value: unknown, op: string, arg: string): boolean {
  const text = value === null || value === undefined ? null : String(value)
  switch (op) {
    case 'eq':
      return text === arg
    case 'neq':
      return text !== arg
    case 'is':
      return arg === 'null' ? text === null : String(value) === arg
    case 'in':
      return arg
        .replace(/^\(|\)$/g, '')
        .split(',')
        .includes(text ?? '')
    case 'gte':
      return text !== null && text >= arg
    case 'gt':
      return text !== null && text > arg
    case 'lte':
      return text !== null && text <= arg
    case 'lt':
      return text !== null && text < arg
    case 'ilike': {
      const needle = arg.replaceAll('%', '').toLowerCase()
      return text !== null && text.toLowerCase().includes(needle)
    }
    default:
      return true
  }
}

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows
  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key) || key.includes('.')) continue
    const negated = raw.startsWith('not.')
    const body = negated ? raw.slice(4) : raw
    const dot = body.indexOf('.')
    const op = body.slice(0, dot)
    const arg = body.slice(dot + 1)
    out = out.filter((row) => compare(row[key], op, arg) !== negated)
  }
  const orderParam = params.get('order')
  if (orderParam) {
    const keys = orderParam.split(',').map((part) => {
      const [col, dir] = part.split('.')
      return { col: col!, sign: dir === 'desc' ? -1 : 1 }
    })
    out = [...out].sort((a, b) => {
      for (const { col, sign } of keys) {
        const x = String(a[col] ?? '')
        const y = String(b[col] ?? '')
        if (x !== y) return x < y ? -sign : sign
      }
      return 0
    })
  }
  return out
}

const strip = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')))

// ---------------------------------------------------------------------------------------------------------
// The mock
// ---------------------------------------------------------------------------------------------------------
export interface MockOptions {
  /** Who is signed in (their session is seeded); `null` = signed out (use the login form). */
  as: Person | null
  lang: 'ar' | 'en'
}

export interface Api {
  world: World
  /** Simulate the database inserting an activity row: it reaches every subscribed Realtime channel. */
  pushActivity(row: Row): void
  realtimeConnected(): boolean
}

export async function installMockApi(page: Page, { as, lang }: MockOptions): Promise<Api> {
  const world = seedWorld()
  let me: Person | null = as

  // Seeded once per tab (sessionStorage marks it), so a sign-out or a language change survives a reload.
  await page.addInitScript(
    ([lng, key, session]) => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.setItem('ajyal.lang', lng as string)
      if (session) localStorage.setItem(key as string, JSON.stringify(session))
    },
    [lang, STORAGE_KEY, as ? sessionFor(as) : null],
  )

  await page.route('**/fonts.g*/**', (route) => route.abort())

  const json = (
    route: Route,
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    route.fulfill({
      status,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
        'access-control-expose-headers': 'content-range',
        'content-type': 'application/json',
        ...headers,
      },
      body: body === null || body === undefined ? '' : JSON.stringify(body),
    })

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'OPTIONS') return json(route, 204, null)
    let body: unknown = null
    try {
      body = request.postDataJSON()
    } catch {
      /* no body */
    }

    // ---- auth
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = (body ?? {}) as { email?: string; password?: string }
      const person = PEOPLE.find((p) => p.email === email)
      if (!person || password !== PASSWORD) {
        return json(route, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
          message: 'Invalid login credentials',
        })
      }
      me = person
      return json(route, 200, sessionFor(person))
    }
    if (url.pathname === '/auth/v1/logout') {
      me = null
      return json(route, 204, null)
    }
    if (url.pathname === '/auth/v1/user')
      return me
        ? json(route, 200, sessionFor(me).user)
        : json(route, 401, { message: 'no session' })

    const path = url.pathname.replace('/rest/v1/', '')
    const q = url.searchParams
    world.calls.push({ method, path, search: url.search, body })
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object+json')
    const isAdmin = me?.role === 'admin'
    const list = (rows: Row[], total = rows.length, extra: Record<string, string> = {}) => {
      const out = rows.map(strip)
      return json(route, 200, wantsObject ? (out[0] ?? null) : out, {
        'content-range': out.length ? `0-${out.length - 1}/${total}` : `*/${total}`,
        ...extra,
      })
    }
    const paged = (rows: Row[]) => {
      const offset = Number(q.get('offset') ?? 0)
      const limit = Number(q.get('limit') ?? 100_000)
      const page_ = rows.slice(offset, offset + limit)
      return json(route, 200, page_.map(strip), {
        'content-range': page_.length
          ? `${offset}-${offset + page_.length - 1}/${rows.length}`
          : `*/${rows.length}`,
      })
    }
    const head = (count: number) =>
      route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
          'content-range': `*/${count}`,
        },
        body: '',
      })
    const own = (rows: Row[], key = 'coach_id') =>
      isAdmin ? rows : rows.filter((r) => r[key] === me?.id)

    try {
      // ---- profiles
      if (path === 'profiles') {
        if (method === 'PATCH') return json(route, 204, null)
        if (q.get('id')?.startsWith('eq.')) {
          const person = PEOPLE.find((p) => p.id === q.get('id')!.slice(3))
          return list(person ? [profileRow(person, lang)] : [])
        }
        if (q.get('role') === 'eq.coach')
          return list(PEOPLE.filter((p) => p.role === 'coach').map((p) => profileRow(p, lang)))
      }

      // ---- locations
      if (path === 'locations') {
        if (method === 'POST') {
          world.locations.push({
            id: uid('loc-new'),
            address: null,
            active: true,
            created_at: stamp(0),
            ...(body as Row),
          })
          return json(route, 201, null)
        }
        if (method === 'PATCH') {
          const id = q.get('id')?.slice(3)
          const row = world.locations.find((l) => l.id === id)
          if (row) Object.assign(row, body)
          return json(route, 200, [{ id }])
        }
        return list(applyFilters(world.locations, q))
      }

      // ---- players
      if (path === 'players') {
        if (method === 'POST') {
          const input = body as Row
          const row: Row = {
            id: uid('p-new'),
            ...input,
            created_by: me?.id,
            created_at: stamp(0),
            deleted_at: null,
            deleted_by: null,
            coach_id: input.coach_id ?? me?.id ?? null,
          }
          row.coach = row.coach_id
            ? { full_name: PEOPLE.find((p) => p.id === row.coach_id)?.full_name }
            : null
          const place = world.locations.find((l) => l.id === row.location_id)
          row.location = place ? { name: place.name } : null
          world.players.unshift(row)
          return json(route, 201, wantsObject ? { id: row.id } : [{ id: row.id }])
        }
        let rows = own(world.players)
        const or = q.get('or')
        if (or) {
          const needle = /ilike\.%(.*?)%/.exec(or)?.[1]?.toLowerCase() ?? ''
          rows = rows.filter((r) =>
            [r.full_name, r.cpr, r.phone].some((v) => String(v).toLowerCase().includes(needle)),
          )
        }
        rows = applyFilters(rows, q)
        if (method === 'HEAD') return head(rows.length)
        return paged(rows)
      }
      if (path === 'player_subscription_status') {
        const wanted = /^in\.\((.*)\)$/.exec(q.get('player_id') ?? '')?.[1]?.split(',') ?? []
        return list(
          wanted.flatMap((id) => {
            const s = world.subscriptions.find(
              (x) => (x._players as string[]).includes(id) && x.status !== 'cancelled',
            )
            return s ? [{ player_id: id, status: s.status }] : []
          }),
        )
      }

      // ---- settings
      if (path === 'plans') return list(applyFilters(world.plans, q))
      if (path === 'settings') return list([world.settings])
      if (path === 'discounts')
        return list(
          applyFilters(isAdmin ? world.discounts : world.discounts.filter((d) => d.active), q),
        )

      // ---- subscriptions
      if (path === 'subscription_overview') {
        const mine = (s: Row) =>
          isAdmin ||
          (s._players as string[]).some(
            (id) => world.players.find((p) => p.id === id)?.coach_id === me?.id,
          )
        const rows = applyFilters(world.subscriptions.filter(mine), q)
        if (method === 'HEAD') return head(rows.length)
        return paged(rows)
      }
      if (path === 'subscription_players') {
        const links = world.subscriptions.flatMap((s) =>
          (s._players as string[]).map((player_id) => ({
            subscription_id: s.id,
            player_id,
            tshirt_fee_fils: 0,
            transport_fee_fils: 0,
            player: {
              id: player_id,
              full_name: String(world.players.find((p) => p.id === player_id)?.full_name),
            },
          })),
        )
        if ((q.get('select') ?? '').includes('subscriptions!inner')) {
          const active = new Set(
            world.subscriptions
              .filter((s) => s.status === 'active' || s.status === 'expiring_soon')
              .flatMap((s) => s._players as string[]),
          )
          return list(
            applyFilters(links, q)
              .filter((l) => active.has(String(l.player_id)))
              .map((l) => ({ player_id: l.player_id, subscriptions: {} })),
          )
        }
        return list(applyFilters(links, q))
      }
      if (path === 'payments') return list(applyFilters(world.payments, q))
      if (path === 'rpc/create_subscription') {
        const params = body as {
          p_players: { player_id: string }[]
          p_end_date: string
          p_start_date: string
          p_location_id: string
        }
        const place = world.locations.find((l) => l.id === params.p_location_id)
        const ids = params.p_players.map((p) => p.player_id)
        const id = uid('s-new')
        world.subscriptions.unshift({
          id,
          plan_id: 'plan-solo',
          plan_code: 'solo',
          start_date: params.p_start_date,
          end_date: params.p_end_date,
          plan_price_fils: 20_000,
          tshirt_total_fils: 0,
          transport_total_fils: 0,
          discount_id: null,
          discount_type: null,
          discount_value: null,
          discount_reason: null,
          discount_fils: 0,
          total_fils: 25_000,
          cancelled_at: null,
          cancel_reason: null,
          created_at: stamp(0),
          paid_fils: 25_000,
          balance_fils: 0,
          status: 'active',
          player_names: ids.map((i) => world.players.find((p) => p.id === i)?.full_name).join(', '),
          player_count: ids.length,
          location_id: params.p_location_id,
          location_name: place?.name ?? null,
          _players: ids,
        })
        return json(route, 200, id)
      }
      if (path === 'rpc/set_subscription_location') {
        const { p_subscription_id, p_location_id } = body as {
          p_subscription_id: string
          p_location_id: string
        }
        const target = world.subscriptions.find((x) => x.id === p_subscription_id)
        const place = world.locations.find((l) => l.id === p_location_id)
        if (target && place)
          Object.assign(target, { location_id: place.id, location_name: place.name })
        return json(route, 200, null)
      }
      if (path.startsWith('rpc/record_payment') || path.startsWith('rpc/cancel_subscription'))
        return json(route, 200, uid('ok'))

      // ---- sessions and attendance
      if (path === 'training_sessions') {
        if (method === 'POST' || method === 'PATCH')
          return json(route, method === 'POST' ? 201 : 200, [{ id: uid('se-new') }])
        const rows = applyFilters(own(world.sessions), q)
        return q.has('limit') && q.has('offset') ? paged(rows) : list(rows)
      }
      if (path === 'attendance') return list(applyFilters(world.attendance, q))
      if (path === 'player_attendance') {
        const rows = world.attendance.map((a) => {
          const s = world.sessions.find((x) => x.id === a.session_id)!
          return {
            session_id: a.session_id,
            player_id: a.player_id,
            status: a.status,
            marked_at: a.marked_at,
            session_date: s.session_date,
            start_time: s.start_time,
            end_time: s.end_time,
            location_id: s.location_id,
            location_name: (s.location as { name: string } | null)?.name ?? null,
            coach_id: s.coach_id,
          }
        })
        const filtered = applyFilters(rows, q)
        if (method === 'HEAD') return head(filtered.filter((r) => r.status === 'present').length)
        return paged(filtered)
      }
      if (path === 'rpc/save_attendance') {
        const { p_session_id, p_records } = body as {
          p_session_id: string
          p_records: { player_id: string; status: string }[]
        }
        for (const r of p_records) {
          const existing = world.attendance.find(
            (a) => a.session_id === p_session_id && a.player_id === r.player_id,
          )
          if (existing) existing.status = r.status
          else
            world.attendance.push({
              session_id: p_session_id,
              player_id: r.player_id,
              status: r.status,
              marked_at: stamp(0),
              player: {
                id: r.player_id,
                full_name: String(world.players.find((p) => p.id === r.player_id)?.full_name),
              },
            })
        }
        return json(route, 204, null)
      }

      // ---- money
      if (path === 'expenses') {
        if (method === 'POST') {
          world.expenses.unshift({
            id: uid('e-new'),
            coach: null,
            created_by: me?.id,
            created_at: stamp(0),
            ...(body as Row),
          })
          return json(route, 201, null)
        }
        if (method === 'PATCH' || method === 'DELETE')
          return json(route, 200, [{ id: q.get('id')?.slice(3) }])
        const rows = applyFilters(world.expenses, q)
        return (q.get('select') ?? '').startsWith('expense_date') ? list(rows) : paged(rows)
      }
      if (
        path === 'rpc/report_summary' ||
        path === 'rpc/revenue_by_month' ||
        path === 'rpc/expenses_by_category' ||
        path === 'rpc/report_by_location'
      ) {
        const where = (body as { p_location_id?: string | null }).p_location_id ?? null
        const inRange = (d: string, from: string, to: string) => d >= from && d <= to
        // A payment belongs to its subscription's location; an expense has its own.
        const locationOfPayment = (payment: Row) =>
          (world.subscriptions.find((x) => x.id === payment.subscription_id)?.location_id ??
            null) as string | null
        const paymentsHere = world.payments.filter((x) => !where || locationOfPayment(x) === where)
        const expensesHere = world.expenses.filter((x) => !where || x.location_id === where)
        const sum = (rows: Row[], from: string, to: string, key: string) =>
          rows
            .filter((r) => inRange(String(r[key]), from, to))
            .reduce((s, r) => s + Number(r.amount_fils), 0)
        if (path === 'rpc/report_by_location') {
          const { p_from, p_to } = body as { p_from: string; p_to: string }
          const ids = new Set<string | null>(
            world.locations.filter((l) => l.active).map((l) => String(l.id)),
          )
          for (const x of world.payments) ids.add(locationOfPayment(x))
          for (const x of world.expenses) ids.add((x.location_id ?? null) as string | null)
          return json(
            route,
            200,
            [...ids].map((location_id) => {
              const c = sum(
                world.payments.filter((x) => locationOfPayment(x) === location_id),
                p_from,
                p_to,
                'paid_at',
              )
              const e = sum(
                world.expenses.filter((x) => (x.location_id ?? null) === location_id),
                p_from,
                p_to,
                'expense_date',
              )
              return {
                location_id,
                collected_fils: c,
                expenses_fils: e,
                profit_fils: c - e,
                margin_bps: c > 0 ? Math.round(((c - e) * 10_000) / c) : null,
              }
            }),
          )
        }
        if (path === 'rpc/report_summary') {
          const { p_from, p_to } = body as { p_from: string; p_to: string }
          const collected = sum(paymentsHere, p_from, p_to, 'paid_at')
          const spent = sum(expensesHere, p_from, p_to, 'expense_date')
          const profit = collected - spent
          return json(route, 200, [
            {
              collected_fils: collected,
              expenses_fils: spent,
              profit_fils: profit,
              margin_bps: collected > 0 ? Math.round((profit * 10_000) / collected) : null,
            },
          ])
        }
        if (path === 'rpc/revenue_by_month') {
          const { p_year } = body as { p_year: number }
          return json(
            route,
            200,
            Array.from({ length: 12 }, (_, i) => {
              const from = `${p_year}-${pad(i + 1)}-01`
              const to = `${p_year}-${pad(i + 1)}-31`
              const c = sum(paymentsHere, from, to, 'paid_at')
              const e = sum(expensesHere, from, to, 'expense_date')
              return { month_start: from, collected_fils: c, expenses_fils: e, profit_fils: c - e }
            }),
          )
        }
        const { p_from, p_to } = body as { p_from: string; p_to: string }
        const totals = new Map<string, number>()
        for (const e of expensesHere.filter((x) => inRange(String(x.expense_date), p_from, p_to)))
          totals.set(
            String(e.category),
            (totals.get(String(e.category)) ?? 0) + Number(e.amount_fils),
          )
        return json(
          route,
          200,
          [...totals].map(([category, total_fils]) => ({ category, total_fils })),
        )
      }
      if (path === 'rpc/generate_monthly_salaries')
        return json(route, 200, [{ created_count: 2, skipped_count: 0, created_fils: 250_000 }])

      // ---- registration requests (the public form and the admin review)
      if (path === 'rpc/public_locations')
        return json(
          route,
          200,
          world.locations
            .filter((l) => l.active)
            .map((l) => ({ id: l.id, name: l.name, address: l.address })),
        )
      if (path === 'rpc/submit_player_applications') {
        const call = body as {
          p_submission_id: string
          p_guardian_name: string
          p_phone: string
          p_location_id: string | null
          p_language: string
          p_children: Row[]
          p_website: string
        }
        world.submitAttempts.push(call)
        const failure = world.failNextSubmit
        world.failNextSubmit = null
        if (failure === 'offline') return route.abort('connectionfailed')
        if (failure === 'rate_limited')
          return json(route, 400, { code: '54000', message: 'ajyal:rate_limited', details: null })
        const place = world.locations.find((l) => l.id === call.p_location_id)
        call.p_children.forEach((child) =>
          world.applications.unshift({
            id: uid('ap-new'),
            submission_id: call.p_submission_id,
            guardian_name: call.p_guardian_name,
            phone: call.p_phone,
            language: call.p_language,
            location_id: call.p_location_id,
            location_name: place?.name ?? null,
            ...child,
            status: 'pending',
            created_at: stamp(0),
            decided_at: null,
            decided_by_name: null,
            decision_note: null,
            player_id: null,
            existing_player_id: null,
            existing_player_name: null,
            same_cpr_pending: 0,
          }),
        )
        return json(route, 204, null)
      }
      if (path === 'player_application_overview') {
        const rows = applyFilters(isAdmin ? world.applications : [], q)
        return q.has('limit') && q.has('offset') ? paged(rows) : list(rows)
      }
      if (path === 'player_applications') {
        const rows = applyFilters(isAdmin ? world.applications : [], q)
        if (method === 'HEAD') return head(rows.length)
        return list(rows)
      }
      if (path === 'rpc/accept_player_application') {
        const { p_application_id, p_coach_id, p_location_id } = body as {
          p_application_id: string
          p_coach_id: string | null
          p_location_id: string | null
        }
        const target = world.applications.find((a) => a.id === p_application_id)
        if (!target)
          return json(route, 404, { code: 'P0002', message: 'ajyal:application_not_found' })
        if (target.status !== 'pending')
          return json(route, 400, { code: '55000', message: 'ajyal:already_decided' })
        const taken = world.players.find((p) => p.cpr === target.cpr)
        if (taken)
          return json(route, 400, {
            code: '23505',
            message: 'ajyal:cpr_taken',
            details: String(taken.id),
          })
        const id = uid('p-acc')
        const place = world.locations.find((l) => l.id === p_location_id)
        world.players.unshift({
          id,
          full_name: target.full_name,
          cpr: target.cpr,
          date_of_birth: target.date_of_birth,
          address: target.address,
          school: target.school,
          phone: target.phone,
          guardian_name: target.guardian_name,
          has_disease: target.has_disease,
          disease_description: target.disease_description,
          coach_id: p_coach_id,
          location_id: p_location_id,
          created_by: me?.id,
          created_at: stamp(0),
          deleted_at: null,
          deleted_by: null,
          coach: p_coach_id
            ? { full_name: PEOPLE.find((p) => p.id === p_coach_id)?.full_name }
            : null,
          location: place ? { name: place.name } : null,
        })
        Object.assign(target, {
          status: 'accepted',
          decided_at: stamp(0),
          decided_by_name: me?.full_name ?? null,
          player_id: id,
          existing_player_id: null,
          existing_player_name: null,
          same_cpr_pending: 0,
        })
        return json(route, 200, id)
      }
      if (path === 'rpc/reject_player_application') {
        const { p_application_id, p_note } = body as { p_application_id: string; p_note?: string }
        const target = world.applications.find((a) => a.id === p_application_id)
        if (!target)
          return json(route, 404, { code: 'P0002', message: 'ajyal:application_not_found' })
        if (target.status !== 'pending')
          return json(route, 400, { code: '55000', message: 'ajyal:already_decided' })
        Object.assign(target, {
          status: 'rejected',
          decided_at: stamp(0),
          decided_by_name: me?.full_name ?? null,
          decision_note: p_note ?? null,
          existing_player_id: null,
          existing_player_name: null,
          same_cpr_pending: 0,
        })
        return json(route, 204, null)
      }

      // ---- activity
      if (path === 'activity_log') {
        let rows = world.activity.filter((r) => isAdmin || r.actor_id === me?.id)
        const types = /^in\.\((.*)\)$/.exec(q.get('entity_type') ?? '')?.[1]?.split(',')
        if (types) rows = rows.filter((r) => types.includes(String(r.entity_type)))
        const cursor = /created_at\.lt\.(.+?),and\(created_at\.eq\.(.+?),id\.lt\.([^)]+)\)\)$/.exec(
          q.get('or') ?? '',
        )
        if (cursor)
          rows = rows.filter(
            (r) =>
              String(r.created_at) < cursor[1]! ||
              (String(r.created_at) === cursor[2] && String(r.id) < cursor[3]!),
          )
        rows = [...rows].sort(
          (a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)) ||
            String(b.id).localeCompare(String(a.id)),
        )
        return json(route, 200, rows.slice(0, Number(q.get('limit') ?? 1000)))
      }
    } catch (error) {
      world.unmatched.push(`ERROR ${method} ${path}${url.search}: ${String(error)}`)
      return json(route, 500, { message: 'mock failure' })
    }

    world.unmatched.push(`${method} ${path}${url.search}`)
    return list([])
  })

  // ---- Realtime (phoenix v2 frames: [join_ref, ref, topic, event, payload])
  const sockets: {
    ws: { send: (data: string) => void }
    topics: Map<string, { id: number; table: string; event: string }[]>
  }[] = []
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    const conn = { ws, topics: new Map<string, { id: number; table: string; event: string }[]>() }
    sockets.push(conn)
    ws.onMessage((raw) => {
      let frame: [
        string | null,
        string | null,
        string,
        string,
        { config?: { postgres_changes?: { event: string; table: string }[] } },
      ]
      try {
        frame = JSON.parse(String(raw))
      } catch {
        return
      }
      const [joinRef, ref, topic, event, payload] = frame
      if (event === 'phx_join') {
        const changes = (payload?.config?.postgres_changes ?? []).map((f, i) => ({
          id: 1000 + i,
          ...f,
        }))
        conn.topics.set(topic, changes)
        ws.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            'phx_reply',
            { status: 'ok', response: { postgres_changes: changes } },
          ]),
        )
      } else if (event === 'heartbeat') {
        ws.send(JSON.stringify([null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]))
      } else if (event === 'phx_leave') {
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
        conn.topics.delete(topic)
      }
    })
  })

  return {
    world,
    pushActivity(row) {
      world.activity.unshift(row)
      for (const { ws, topics } of sockets) {
        for (const [topic, changes] of topics) {
          const match = changes.find((c) => c.table === 'activity_log' && c.event === 'INSERT')
          if (!match) continue
          ws.send(
            JSON.stringify([
              null,
              null,
              topic,
              'postgres_changes',
              {
                ids: [match.id],
                data: {
                  schema: 'public',
                  table: 'activity_log',
                  commit_timestamp: new Date().toISOString(),
                  type: 'INSERT',
                  record: row,
                  columns: [],
                  errors: null,
                },
              },
            ]),
          )
        }
      }
    },
    realtimeConnected: () => sockets.some((s) => s.topics.size > 0),
  }
}

/** A new activity row as the database would write it. */
export function activityRow(action: string, actor: Person, summary: Row): Row {
  return {
    id: `ffffffff-0000-0000-0000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    actor_id: actor.id,
    action,
    entity_type: action.split('.')[0],
    entity_id: null,
    summary: { actor_name: actor.full_name, ...summary },
    created_at: stamp(0),
  }
}
