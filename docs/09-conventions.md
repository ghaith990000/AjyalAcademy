# Conventions

## Code style

- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any` (use `unknown` + narrowing). `import type` for types (enforced by lint).
- Prettier (no semicolons, single quotes, trailing commas, 100 cols) and ESLint flat config; run `npm run format` before finishing.
- Files: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `camelCase.ts`, tests `*.test.ts(x)` next to the code.
- One exported component per file; feature pages are `features/<x>/<Thing>Page.tsx`. Path alias `@/`.
- Prefer small pure functions in `lib/` or `features/<x>/` for logic; components stay declarative.
- Comments explain **why**, not what. No dead code, no TODOs without an ID in the phase file.

## Data and API

- All Supabase access in `features/<x>/api.ts`, typed with generated DB types. Components never call `supabase` directly.
- Reads → `useQuery` with feature-prefixed keys; writes → `useMutation` that invalidates by prefix and shows a translated toast.
- Money in fils everywhere in code; convert only at the input/display boundary.
- Migrations: one file per change in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`), never edit an applied migration — add a new one. Regenerate DB types after each.

## Testing

| Layer          | Tool                              | Must cover                                                                                                                                |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic     | Vitest                            | `money.ts`, `pricing.ts` (all worked examples in 05-business-rules), date/period helpers, report math                                     |
| Components     | Vitest + Testing Library          | Forms' validation & conditional fields (e.g. disease description), plan picker, attendance toggling                                       |
| Database / RLS | pgTAP (`supabase/tests/database`) | Coach isolation, no direct `activity_log` writes, `create_subscription` rules, report RPC results                                         |
| End to end     | Playwright + axe (`e2e/`)         | Login and guards, add player, subscribe, attendance, reports, live feed, PWA, CSP, and an audit of every screen at 390px in `ar` and `en` |
| i18n           | Vitest                            | `ar` and `en` key sets are identical                                                                                                      |

Write the test for a business rule **before or with** the code; use the worked examples as fixtures.

### End-to-end tests

`npm run e2e` (Playwright, config in `playwright.config.ts`) builds the app, serves it with `vite preview` and drives a real browser at phone width (390px). It uses your installed Chrome; in CI run `npx playwright install --with-deps chromium` first and set `CI=1`.

- **The API is always a mock** (`e2e/support/mock-api.ts`) at the fake URL `https://e2e.supabase.test` — the auth endpoint, the PostgREST tables and functions the app uses, and the Realtime socket (phoenix v2 frames). No real Supabase project is ever contacted, so the suite needs no credentials and can never change real data. The mock is stateful within a test (a created player or subscription shows up afterwards).
- **A request the mock does not recognise is recorded, and the audit fails on it.** So a new query in the app must be taught to the mock — that keeps the mock honest. What the mock cannot prove (real RLS, real Realtime) is covered by the pgTAP tests, the `anon` request-shape checks and the owner's live check.
- **Specs:** `auth` (sign-in, guards, sign-out, language, expired session), `flows` (add player, subscribe, take attendance, reports, live activity, future sessions), `pwa` (manifest, icons, installability, offline shell, nothing of the API cached — the one spec that allows the service worker), `csp` (the app runs under its Content-Security-Policy), `audit` (every route for both roles in both languages, the main dialogs, the phone menu: no sideways scroll, no tap target under 44px, no WCAG 2.1 A/AA violation from axe, the right reading direction).
- **Locations:** the mock seeds three (`loc-1` Arabic name, `loc-2` Latin name, `loc-3` switched off), gives players, sessions, subscriptions and expenses a location, and answers `report_by_location`, `set_subscription_location` and the location argument of the report functions; the audit visits `/admin/locations` and its dialog.
- Labels come from the locale files (`t(lang, 'ns:key')` in `e2e/support/app.ts`), never typed by hand, so a wording change does not break a spec.
- `npm test` (Vitest) ignores `e2e/`.

### Running the database tests

Each file in `supabase/tests/database/*.test.sql` is standalone: `begin; … rollback;` with its own fixtures (ids `f0000000-…`, distinct from `seed.sql`), so it is safe against any database.

- **Local stack (Docker):** `npx supabase test db`.
- **Hosted project (no Docker):** send the file's SQL through the Supabase MCP `execute_sql` tool. pgTAP's per-test output is not returned by that tool, so for the run prefix each assertion (`select is(…)`, `throws_ok(…)`, …) with `insert into _tap ` after `create temp table _tap (line text); grant all on _tap to public;`, and end with `select count(*) filter (where line like 'ok %') passed, count(*) filter (where line like 'not ok%') failed, string_agg(line, E'\n') filter (where line like 'not ok%') failures from _tap; rollback;`. Expected: 0 failures (each file's assertion count is `grep -cE '^select (is|ok|lives_ok|throws_ok|throws_like|is_empty)\\(' <file>`; 434 across the six files after Phase 6 (Phase 7 adds none)).
- Sessions can no longer be inserted without a location: a pgTAP file that inserts sessions creates a test location and sets `alter table public.training_sessions alter column location_id set default …` inside its own rolled-back transaction (see `01`, `05`); `create_subscription` takes the location as its 4th argument (`tests.loc()` in `04`).
- A new table or function needs a test here in the same change; the privilege-audit assertions in `01_access_control.test.sql` fail if `anon` gains access or RLS is missing.

## Git

Remote: `origin` = `git@github-personal:ghaith990000/AjyalAcademy.git` (branch `main`). `github-personal` is an SSH host alias in `~/.ssh/config` that selects the personal `ghaith990000` key — do **not** use `git@github.com:` here, it would authenticate with the default work key. Commit identity is set repo-locally (`user.email` = the personal address); leave the global config alone. One commit per meaningful step, imperative message, phase prefix (`phase-3: add player form`). Commit at the end of each phase at minimum. Never commit `.env*` files or Supabase service keys.

## Secrets

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the browser. The **service role key** is used only inside the `create-coach` Edge Function (Supabase-managed secret) and never in `src/`.

## Tooling in the repo

- `.mcp.json` connects Claude Code to the hosted Supabase project (OAuth on first use; it holds the project reference only, no key). Migrations, SQL, types, Edge Function deploys and advisors go through it (D-030).
- `.agents/skills/` and `skills-lock.json` are the Supabase agent skills (`npx skills add supabase/agent-skills`), pinned by hash. Load `supabase` / `supabase-postgres-best-practices` before writing SQL.
- `.claude/settings.local.json` is personal and git-ignored.

## Definition of Done (every phase)

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass; DB tests pass (Phase 2+); `npm run e2e` passes (Phase 8+).
2. Phase file: all tasks ticked, acceptance criteria met, **Handoff notes** written (what exists, gotchas, what's next).
3. [ROADMAP.md](ROADMAP.md) status and [02-requirements.md](02-requirements.md) statuses updated.
4. Any new decision → [08-decisions.md](08-decisions.md); schema/rule/design/i18n changes → the matching doc.
5. Manually verified in a browser at **390px and desktop**, in **Arabic and English**.
6. No unrelated refactors; no work from later phases.
