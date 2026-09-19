// Edge Function: create-coach
//
// Creates a coach account (auth user + profile) on behalf of a signed-in ADMIN.
// Why a function: creating auth users needs the service-role key, which must never reach the browser.
//
// Request  POST  { full_name, email, password, phone?, monthly_salary_fils?, preferred_language? }
// Success  201   { id }
// Errors   JSON { error: <code>, field? }:
//   401 unauthorized · 403 forbidden · 400 invalid_input (+field) · 409 email_taken
//   422 weak_password · 500 server_error
//
// Deployed with verify_jwt = true (supabase/config.toml); the admin check below is the real gate.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateCreateCoach } from './validate.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_error' })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(401, { error: 'unauthorized' })

  // 1. Who is calling? Use the caller's own token so RLS applies to the admin check.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'unauthorized' })
  const caller = userData.user

  const { data: profile } = await asCaller
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', caller.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin' || !profile.active)
    return json(403, { error: 'forbidden' })

  // 2. Validate input.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid_input', field: 'body' })
  }
  const parsed = validateCreateCoach(body)
  if (!parsed.ok) return json(400, { error: 'invalid_input', field: parsed.field })
  const input = parsed.value

  // 3. Create the account with the service role.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  })
  if (createError || !created.user) {
    if (createError?.code === 'email_exists') return json(409, { error: 'email_taken' })
    if (createError?.code === 'weak_password') return json(422, { error: 'weak_password' })
    console.error('createUser failed', createError?.code, createError?.message)
    return json(500, { error: 'server_error' })
  }
  const newId = created.user.id

  const { error: profileError } = await admin.from('profiles').insert({
    id: newId,
    full_name: input.full_name,
    email: input.email,
    role: 'coach',
    phone: input.phone,
    monthly_salary_fils: input.monthly_salary_fils,
    preferred_language: input.preferred_language,
  })
  if (profileError) {
    console.error('profile insert failed', profileError.message)
    await admin.auth.admin.deleteUser(newId) // roll back so the email is not left half-registered
    return json(500, { error: 'server_error' })
  }

  // 4. Audit trail (service role bypasses RLS; clients can never write this table).
  const { error: logError } = await admin.from('activity_log').insert({
    actor_id: caller.id,
    action: 'coach.created',
    entity_type: 'coach',
    entity_id: newId,
    summary: { coach_name: input.full_name, actor_name: profile.full_name },
  })
  if (logError) console.error('activity log failed', logError.message)

  return json(201, { id: newId })
})
