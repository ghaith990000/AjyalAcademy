# Architecture

## Stack

| Concern      | Choice                                                              | Notes                                                             |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Build / UI   | Vite + React 19 + TypeScript (`strict`, `noUncheckedIndexedAccess`) | SPA. Path alias `@/` → `src/`.                                    |
| Routing      | React Router (data-router, lazy routes per feature)                 | Role-guarded route groups: `/admin/*`, `/coach/*` (see below).    |
| Server state | TanStack Query                                                      | All Supabase calls live in `features/*/api`, wrapped by hooks.    |
| Backend      | Supabase: Postgres, Auth, RLS, Realtime, one Edge Function          | Hosted project for dev (D-030); local Docker optional.            |
| Styling      | Tailwind CSS v4 (`@theme` tokens in `src/styles/index.css`)         | Logical properties only (RTL). Radix primitives for a11y widgets. |
| Forms        | react-hook-form + zod (`@hookform/resolvers`)                       | One zod schema per form in `features/*/schemas.ts`.               |
| i18n         | i18next + react-i18next                                             | `ar` (default, RTL) and `en`. See [07-i18n.md](07-i18n.md).       |
| Charts       | Recharts                                                            | Brand palette only.                                               |
| Dates        | date-fns                                                            | Gregorian; store `date` columns as ISO `YYYY-MM-DD`.              |
| Icons        | lucide-react                                                        | Flip directional icons in RTL.                                    |
| PWA          | vite-plugin-pwa (Phase 8)                                           | Installable on phones.                                            |
| Tests        | Vitest + Testing Library; SQL RLS tests; Playwright smoke (Phase 8) |                                                                   |

## Folder layout

```
src/
  app/             router, providers (QueryClient, Auth, i18n), layouts (AdminShell, CoachShell, AuthLayout)
  components/ui/   design-system components (Button, Input, Select, Card, Dialog, Badge, DataList, Toast, EmptyState…)
  features/
    auth/          login, session, role guards
    players/  coaches/  subscriptions/  discounts/  sessions/  attendance/
    expenses/  reports/  activity/  settings/
      api/         supabase queries/mutations (thin, typed)
      hooks/       useXxx wrappers around TanStack Query
      components/  feature-specific UI
      pages/       route components
      schemas.ts   zod schemas + inferred types
  lib/             supabase.ts, money.ts, pricing.ts, dates.ts, i18n.ts, utils.ts
  locales/{ar,en}/ one JSON namespace per feature (common, players, subscriptions, …)
  styles/          index.css (Tailwind + tokens)
  test/            vitest setup, factories
supabase/          config.toml, migrations/, seed.sql, functions/create-coach/, tests/
docs/              this documentation
public/brand/      logo assets
```

## Data flow

```
Page → hook (TanStack Query) → feature api (supabase-js) → Postgres (RLS enforces role rules)
                                                     └→ RPC for multi-row writes (single transaction)
Postgres triggers / RPCs → activity_log → Realtime channel → Home feed (invalidates query)
```

- **RLS is the security boundary.** The UI hides what a role cannot do, but never relies on hiding.
- **Composite writes use RPCs** (`create_subscription`, `save_attendance`, `generate_monthly_salaries`, …) so they are atomic and can write the activity log.
- **Reports use SQL RPCs** (`report_summary`, `revenue_by_month`, `expenses_by_category`) — sums are computed in Postgres in integer fils.
- **Types:** regenerate DB types after each migration — `npx supabase gen types typescript --local > src/lib/database.types.ts`, or the Supabase MCP `generate_typescript_types` for the hosted project — and run Prettier on the result; feature `types.ts` derive from it.

## Routing and roles

- `/login` — public.
- `/` — redirects by role: admin → `/admin`, coach → `/coach`.
- `/admin/*` — admin only: home, players, coaches, subscriptions, discounts, sessions, expenses, reports, settings.
- `/coach/*` — coach (admin may also visit): home, my players, subscriptions, sessions/attendance.
- Guards read the role from `profiles` via the Auth provider; unauthorized → redirect to the role's home. _Built: an admin is also redirected out of `/coach`._
- Shared feature pages (players, subscriptions, sessions) are the same components mounted under both prefixes; RLS scopes the data.

## Patterns to follow

- **One place per concept:** money → `lib/money.ts`; total calculation → `lib/pricing.ts` (mirrored by SQL `calc_subscription_total`); date-range helpers → `lib/dates.ts`.
- **Query keys** are arrays starting with the feature: `['players', { search, coachId }]`. Mutations invalidate by feature prefix.
- **Errors:** api functions throw typed errors; hooks surface them; UI shows a translated toast. Never show raw Postgres messages.
- **Loading/empty/error states** are required for every list and page (use `EmptyState`, skeletons).
- **Responsive lists:** `DataList` renders a table ≥ `md` and cards below.
- **No business logic in components** — extract to `lib/` or `features/*/` pure functions with unit tests.

## As built (Phase 1)

- Routes are declared in `src/app/routes.tsx` (an array of `RouteObject`s, so tests can use `createMemoryRouter(routes)`); `src/app/App.tsx` creates the browser router. Until Phase 2 the `/admin` and `/coach` areas are open; Phase 2 adds role guards. `/dev/ui` exists only when `import.meta.env.DEV`.
- Providers live in `src/app/providers.tsx` (Radix `Direction.Provider` + `ToastProvider`). TanStack Query and Auth providers arrive in Phase 2.
- Placeholder pages showed "arrives in phase N" for sections built later (`PlaceholderPage`, removed in Phase 6 once its last two routes were built).

## As built (Phase 2)

- **Providers** (`src/app/providers.tsx`): Radix direction → `ToastProvider` → `QueryProvider` (TanStack Query; a failed request that is not `meta.silent` shows a translated toast, only network errors are retried). `App.tsx` adds `AuthProvider` around the router.
- **Client and types:** `src/lib/supabase.ts` (fails fast if env vars are missing), `src/lib/database.types.ts` (generated), `src/lib/errors.ts` (`errorKeyOf` → `errors` i18n key; raw messages are never shown).
- **Auth** (`src/features/auth`): `AuthProvider` exposes `useAuth()` → `{ status: loading | signedOut | signedIn | error, session, profile, signIn, signOut, retry }`. Guards in `guards.tsx`: `RequireRole`, `RedirectIfSignedIn`, `RootRedirect`. Behaviour: D-037. Tests fake it with `AuthContext.Provider` and `src/test/auth.ts`.
- **Coaches** (`src/features/coaches`): `api.ts` (list/update via table access; create via the `create-coach` Edge Function), `hooks.ts`, `schema.ts` (zod; messages are i18n keys), `CoachDialogs.tsx`, `CoachesPage.tsx`. The salary is typed in BD and stored as integer fils (`fromBD`).
- **Edge Function** `supabase/functions/create-coach`: deployed with `verify_jwt = true`; re-checks that the caller is an active admin; rolls back the auth user if the profile insert fails.
- **Env:** `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key). Tests set dummy values in `vite.config.ts`.

## As built (Phase 3)

- **`src/features/players`:** `api.ts` (list with filters + paging, detail, create/update, `remove_player` and `assign_players` RPCs, `DuplicateCprError`), `hooks.ts` (`usePlayersList` infinite query, `usePlayer`, mutations, `usePlayersBasePath`), `schema.ts` (zod; `toPlayerInput` maps the form to the row: blank → null, description cleared without a condition), `PlayersPage`, `PlayerDetailPage`, `PlayerFormDialog`, `AssignPlayersDialog`, `RemovePlayerDialog`.
- **Routes:** the same page components under `/admin/players[/:id]` and `/coach/players[/:id]`.
- **Query keys:** `['players', 'list', filters]`, `['players', 'detail', id]`; every player mutation invalidates the `['players']` prefix. Coach names for filters/assignment come from `['coaches']` (admin only).
- **Age** is computed from the date of birth (`ageInYears` in `lib/dates.ts`), never stored.

## As built (Phase 4)

- **`src/lib`:** `pricing.ts` (`calcSubscriptionTotal`, `discountFils`, `planCodeForCount` — integer fils, half-up rounding), `subscription-status.ts`, `discounts.ts` (percent ⇄ basis points, display), `money.ts` `parseBD`, `dates.ts` `defaultEndDate`. `components/ui/Money.tsx` renders an amount in `<bdi>`.
- **`features/subscriptions`:** `api.ts` (views + the three RPCs), `hooks.ts`, `draft.ts` (the wizard's state, pricing context, discount preview, per-step validation, RPC payload — React-free and tested against the worked examples), `wizard/*` (six steps), `NewSubscriptionPage`, `SubscriptionsPage`, `SubscriptionDetailPage`, `AddPaymentDialog`, `CancelSubscriptionDialog`, `PlayerSubscriptionsCard`, `useSubscriptionError` (business-rule errors → translated messages; an overlap names the players).
- **`features/settings`** (plan prices, fees, reminder window; also the shared `usePlans`/`useSettings`) and **`features/discounts`** (list + dialog, usage count via an embedded `subscriptions(count)`).
- **Routes:** `/admin|coach/subscriptions`, `…/new[?player=<id>]`, `…/:id`; `/admin/discounts`; `/admin/settings`. The players list shows the real subscription status (a second request for the visible players); the player page shows their subscription history and a "New subscription" shortcut.

## As built (Phase 5)

- **`src/features/sessions`:** `schedule.ts` (pure: status, overlaps, weekly dates, agenda grouping, the "done" filter), `schema.ts` (zod; `toSessionInputs` expands a repeat into rows), `api.ts` (list with paging and status/coach filters, detail, bulk insert, update, cancel, a coach's sessions in a date range for the overlap warning), `hooks.ts`, `useSessionError.ts` (`ajyal:` codes → `sessions:error.*`), `SessionsPage` (agenda grouped by day), `SessionFormDialog` (schedule/edit), `SessionDetailPage`, `CancelSessionDialog`, `SessionStatusBadge`.
- **`src/features/attendance`:** `marks.ts` (pure: initial marks, toggle, mark all, counts, records, "has changes", rate), `api.ts` (roster, a session's marks, `save_attendance`, a player's history from `player_attendance`, present count), `hooks.ts`, `AttendancePage` (the on-pitch screen), `SessionAttendanceCard` (who attended, on the session page), `PlayerAttendanceCard` (rate + history, on the player page).
- **Routes:** `/admin|coach/sessions`, `…/sessions/:id`, `…/sessions/:id/attendance`. Query keys `['sessions', 'list' | 'detail' | 'range', …]`, `['attendance', 'roster' | 'session' | 'player' | 'player-present', …]`; saving attendance invalidates `['attendance']`, session writes invalidate `['sessions']`.
- The roster warning uses `usePlayersCoveredOn` (subscriptions feature): `subscription_players` joined to non-cancelled subscriptions covering the session date.

## As built (Phase 6)

- **`src/lib/reports.ts`** (pure, tested): `marginBps` / `formatMargin` / `sharePercent`, the `Period` type (a calendar month or year) with `periodRange`, `shiftPeriod`, `switchKind`, `isLatestPeriod`, and the CSV helpers (`csvCell` neutralises formula-looking text, `toCsv`, `CSV_BOM`, `csvFileName`). `dates.ts` gained `formatMonthYear` / `formatMonthName`; `money.ts` gained `currencyLabel`.
- **`src/features/expenses`:** `categories.ts`, `schema.ts` (zod; `toExpenseInput`), `api.ts` (month list with category filter and paging, create/update/delete, `generateMonthlySalaries`), `hooks.ts` (every write invalidates `['expenses']` and `['reports']`), `useExpenseError.ts`, `ExpensesPage` (month switcher, totals bar, category chips, list), `ExpenseFormDialog` (a salary asks for the coach and prefills their salary), `DeleteExpenseDialog`, `GenerateSalariesDialog`, `CategoryChips`.
- **`src/features/reports`:** `api.ts` (the three report functions mapped to camelCase, plus the paged CSV reads), `hooks.ts` (`['reports', 'summary' | 'months' | 'categories', …]`), `PeriodSwitcher` (shared with the expenses page and the salary dialog), `ReportsPage` (KPI cards, chart, category breakdown, month table, export), `RevenueChart` (Recharts `ComposedChart`), `CategoryBreakdown`, `MonthsTable`, `ExportCard`, `exportCsv.ts` (builders + `downloadCsv`).
- **Routes:** `/admin/expenses` and `/admin/reports` (admin only — a coach is redirected to `/coach`). The reports route is `lazy` and the admin route group has a `HydrateFallback` (`app/RouteLoading`).
- The expenses page reuses `useExpensesByCategory` from the reports feature for its totals bar, so the month's total is the same number the report shows.
