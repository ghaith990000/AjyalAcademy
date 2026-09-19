import { z } from 'zod'

/**
 * Zod compiles faster validators with `new Function` unless told not to. That is blocked by the app's
 * Content-Security-Policy (no `unsafe-eval`), and the schemas here are tiny forms, so the plain interpreter is
 * plenty fast. Imported first in `main.tsx`.
 */
z.config({ jitless: true })
