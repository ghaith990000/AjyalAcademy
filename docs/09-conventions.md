# Conventions

## Code style

- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any` (use `unknown` + narrowing). `import type` for types (enforced by lint).
- Prettier (no semicolons, single quotes, trailing commas, 100 cols) and ESLint flat config; run `npm run format` before finishing.
- Files: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `camelCase.ts`, tests `*.test.ts(x)` next to the code.
- One exported component per file; feature pages under `features/<x>/pages`. Path alias `@/`.
- Prefer small pure functions in `lib/` or `features/<x>/` for logic; components stay declarative.
- Comments explain **why**, not what. No dead code, no TODOs without an ID in the phase file.

## Data and API

- All Supabase access in `features/<x>/api/*.ts`, typed with generated DB types. Components never call `supabase` directly.
- Reads → `useQuery` with feature-prefixed keys; writes → `useMutation` that invalidates by prefix and shows a translated toast.
- Money in fils everywhere in code; convert only at the input/display boundary.
- Migrations: one file per change in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`), never edit an applied migration — add a new one. Regenerate DB types after each.

## Testing

| Layer          | Tool                              | Must cover                                                                                            |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pure logic     | Vitest                            | `money.ts`, `pricing.ts` (all worked examples in 05-business-rules), date/period helpers, report math |
| Components     | Vitest + Testing Library          | Forms' validation & conditional fields (e.g. disease description), plan picker, attendance toggling   |
| Database / RLS | pgTAP (`supabase/tests/database`) | Coach isolation, no direct `activity_log` writes, `create_subscription` rules, report RPC results     |
| End to end     | Playwright (Phase 8)              | Login, add player, subscribe, attendance, at 390px in `ar` and `en`                                   |
| i18n           | Vitest                            | `ar` and `en` key sets are identical                                                                  |

Write the test for a business rule **before or with** the code; use the worked examples as fixtures.

### Running the database tests

Each file in `supabase/tests/database/*.test.sql` is standalone: `begin; … rollback;` with its own fixtures (ids `f0000000-…`, distinct from `seed.sql`), so it is safe against any database.

- **Local stack (Docker):** `npx supabase test db`.
- **Hosted project (no Docker):** send the file's SQL through the Supabase MCP `execute_sql` tool. pgTAP's per-test output is not returned by that tool, so for the run prefix each assertion (`select is(…)`, `throws_ok(…)`, …) with `insert into _tap ` after `create temp table _tap (line text); grant all on _tap to public;`, and end with `select count(*) filter (where line like 'ok %') passed, count(*) filter (where line like 'not ok%') failed, string_agg(line, E'\n') filter (where line like 'not ok%') failures from _tap; rollback;`. Expected: 0 failures (each file's assertion count is `grep -cE '^select (is|ok|lives_ok|throws_ok|throws_like|is_empty)\\(' <file>`; 274 across the four files after Phase 4).
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

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass; DB tests pass (Phase 2+).
2. Phase file: all tasks ticked, acceptance criteria met, **Handoff notes** written (what exists, gotchas, what's next).
3. [ROADMAP.md](ROADMAP.md) status and [02-requirements.md](02-requirements.md) statuses updated.
4. Any new decision → [08-decisions.md](08-decisions.md); schema/rule/design/i18n changes → the matching doc.
5. Manually verified in a browser at **390px and desktop**, in **Arabic and English**.
6. No unrelated refactors; no work from later phases.
