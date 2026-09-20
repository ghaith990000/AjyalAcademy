# Architecture

## Stack

| Concern      | Choice                                                              | Notes                                                             |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Build / UI   | Vite + React 19 + TypeScript (`strict`, `noUncheckedIndexedAccess`) | SPA. Path alias `@/` → `src/`.                                    |
| Routing      | React Router (data-router, lazy routes per feature)                 | Role-guarded route groups: `/admin/*`, `/coach/*` (see below).    |
| Server state | TanStack Query                                                      | All Supabase calls live in `features/*/api`, wrapped by hooks.    |
| Backend      | Supabase: Postgres, Auth, RLS, Realtime, one Edge Function          | Hosted project for dev (D-030); local Docker optional.            |
| Styling      | Tailwind CSS v4 (`@theme` tokens in `src/styles/index.css`)         | Logical properties only (RTL). Radix primitives for a11y widgets. |
| Forms        | react-hook-form + zod (`@hookform/resolvers`)                       | One zod schema per form in `features/*/schema.ts`.                |
| i18n         | i18next + react-i18next                                             | `ar` (default, RTL) and `en`. See [07-i18n.md](07-i18n.md).       |
| Charts       | Recharts                                                            | Brand palette only.                                               |
| Dates        | date-fns                                                            | Gregorian; store `date` columns as ISO `YYYY-MM-DD`.              |
| Icons        | lucide-react                                                        | Flip directional icons in RTL.                                    |
| PWA          | vite-plugin-pwa                                                     | Installable; offline app shell; update prompt (D-074).            |
| Tests        | Vitest + Testing Library; pgTAP; Playwright (+ axe)                 | Browser tests run the production build against a mock API.        |

## Folder layout

```
src/
  app/             App, providers, routes (lazy pages), shells (layouts/), error screens, pwa/ (update, offline, install)
  components/ui/   design-system components (Button, Input, Select, Card, Dialog, Badge, DataList, FilterChips, Toast…)
  features/<x>/    auth, players, coaches, subscriptions, discounts, sessions, attendance, expenses, reports,
                   activity, home, settings, locations, applications (admin review), register (the public form) (+ dev, the component gallery — development only)
                     api.ts            supabase queries/mutations (thin, typed)
                     hooks.ts          useXxx wrappers around TanStack Query
                     schema.ts         zod schema + inferred types (where the feature has forms)
                     <Thing>Page.tsx   route components; <Thing>Dialog.tsx etc. feature UI
                     *.test.ts(x)      next to the code
  lib/             supabase.ts, money.ts, pricing.ts, dates.ts, reports.ts, i18n.ts, errors.ts, utils.ts, …
  locales/{ar,en}/ one JSON namespace per feature (common, players, subscriptions, …)
  styles/          index.css (Tailwind + tokens)
  test/            vitest setup, fixtures (players, sessions, finance, activity…)
e2e/               Playwright specs + support/ (mock API, helpers)
supabase/          config.toml, migrations/, seed.sql, functions/create-coach/, tests/database/
docs/              this documentation
public/brand/      logo and the generated app icons
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
- `/coach/*` — coaches only (an admin is sent to `/admin`): home, my players, subscriptions, sessions/attendance.
- Guards read the role from `profiles` via the Auth provider; unauthorized → redirect to the role's home.
- `/dev/ui` (component gallery) exists only in development builds.
- Shared feature pages (players, subscriptions, sessions) are the same components mounted under both prefixes; RLS scopes the data.

## Patterns to follow

- **One place per concept:** money → `lib/money.ts`; total calculation → `lib/pricing.ts` (mirrored by SQL `calc_subscription_total`); date-range helpers → `lib/dates.ts`.
- **Query keys** are arrays starting with the feature: `['players', { search, coachId }]`. Mutations invalidate by feature prefix.
- **Errors:** api functions throw typed errors; hooks surface them; UI shows a translated toast. Never show raw Postgres messages.
- **Loading/empty/error states** are required for every list and page (use `EmptyState`, skeletons).
- **Responsive lists:** `DataList` renders a table ≥ `md` and cards below.
- **No business logic in components** — extract to `lib/` or `features/*/` pure functions with unit tests.

## As built (Phase 1)

- Routes are declared in `src/app/routes.tsx` (an array of `RouteObject`s, so tests can use `createMemoryRouter(routes)`); `src/app/App.tsx` creates the browser router. (Role guards were added in Phase 2.) `/dev/ui` exists only when `import.meta.env.DEV`.
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

## As built (Phase 7)

- **`src/features/activity`:** `activity.ts` (pure: the actions and their icon / tone, the filter chips, `describeActivity` → sentence key + values + optional detail, defensive about missing or malformed snapshot fields), `api.ts` (`listActivity` — newest first, keyset cursor, chip filter), `hooks.ts` (`useActivityFeed` infinite query, refetched every minute; `useActivityRealtime` — a Supabase Realtime channel on `activity_log` INSERTs that invalidates `['activity']`, `['home']`, `['reports']` and `['sessions']` and reports whether it is connected), `ActivityItem` (avatar with an action icon, the sentence rendered with `Trans`, a detail line, a `<time>`), `ActivityFeed` (title, live badge, chips, list, "Show more", empty / filtered-empty / error states).
- **`src/features/home`:** `api.ts` (player and subscription counts, the expiring list), `hooks.ts` (`['home', …]`), `HomePage` (hero, quick actions, KPI cards, two columns from `lg`: sessions + expiring on one side, the feed on the other), `QuickActions` (add player and schedule session open their forms in place; new subscription links to the wizard), `TodaySessions`, `ExpiringSubscriptions`. Today's sessions come from `listTodaySessions` / `useTodaySessions` in the sessions feature, and the money KPIs from `useReportSummary` (reports feature).
- The channel is opened while the home screen is mounted; anything that happened while the app was elsewhere is picked up by the queries refetching when the screen returns. `src/lib/useNow.ts` re-renders "5 minutes ago" as time passes; `formatTimeAgo` / `formatRelative` are in `lib/dates.ts`.
- App-shell tests replace `HomePage` with a stub: tests never reach the network (the real page has its own tests).

## As built (Phase 8)

- **Code splitting:** every page is loaded on demand (`page()` in `routes.tsx`); the shells, login and guards stay in the main bundle (633 kB, 195 kB gzipped, down from 1.13 MB). The charting library sits in the reports page's own chunk. `index.html` shows a small logo splash until the app has drawn.
- **PWA** (`vite.config.ts` → `VitePWA`, `src/app/pwa`): `registerType: 'prompt'` — `UpdatePrompt` registers the service worker and offers "Update"; `OfflineBanner` (via `useOnline`) and `InstallHint` (Android's install event, or the Share-sheet steps on iPhone) sit on the shells and the home screen. The service worker precaches the app shell only (scripts, styles, fonts, icons); requests to Supabase are never cached. Icons come from `npm run icons` (`pwa-assets.config.ts`) into `public/brand/`. Fonts are self-hosted (`@fontsource`), so nothing third-party is loaded.
- **Resilience:** `AppErrorBoundary` (rendering errors) and router `errorElement`s (`RouteErrorPage` — inside the shell, so the navigation stays) show `ErrorScreen`; a failed page download gets its own wording (`chunkError.ts`). `QueryProvider` ends the session when the server rejects the login (any query, silent or not, `endSession`) and `AuthProvider` remembers involuntary sign-outs (`sessionNotice.ts`) so the login screen explains.
- **Security headers:** a strict Content-Security-Policy (`vite.config.ts` for `vite preview`; `vercel.json` / `netlify.toml` for hosting); zod runs without its JIT (`lib/zod-config.ts`) because the policy forbids `eval`.
- **End-to-end tests** (`e2e/`, `playwright.config.ts`): see [09-conventions.md](09-conventions.md#end-to-end-tests).

## As built (Phase 9)

- **`src/features/locations`:** the admin page (`LocationsPage`, `LocationDialog`, `/admin/locations`, under _More_), `useLocations()` (all locations, kept fresh 5 minutes, `meta.silent`), and **`LocationField` / `LocationSelect`** — the one select every form and filter uses. It offers the locations in use plus the record's own current one, disables itself until the list has arrived and re-mounts then (so a form's default value lands on the finished list), takes `emptyLabel` ("No location", "All locations") and `extraOptions` (a filter's "No location" choice), and — when a location is required but none exists — says what to do about it.
- **Where locations show up:** the session form and agenda (with a filter), the subscription wizard's _Location and period_ step (default = the players' shared location, `sharedPlayerLocation` in `draft.ts`), the subscription list (filter) and detail (admin: _Change location_ → `set_subscription_location`), the expense form and list (filter), the player form and list (filter), the reports page (filter + `LocationBreakdown`), both CSV files, and the activity feed.
- **Tests:** `src/test/setup.ts` mocks the locations API for every test (three locations: Al-Rifa, Hamad City, and a switched-off Old Field; `src/test/locations.ts`) — a test that cares overrides `listLocations`. The e2e mock knows `locations`, the two new RPCs and location-aware report functions.

## As built (Phase 10)

- **`src/features/register`** — the public form (`RegisterPage`, `/register`, outside every route guard, in `PublicLayout`: brand bar, language switch, a "Staff? Sign in" link). React Hook Form with a field array (1–4 children) and a zod schema built per render (`createRegisterSchema({ locationRequired })`); `usePublicLocations()` reads `public_locations()`; `submitApplications` calls `submit_player_applications` with a submission id made once per form (a retry after a dropped connection is stored once) and the hidden honeypot field. A failed send keeps every answer and says why (`errorKeyOf` for the network, `ajyalCodeOf` for the limits and refusals).
- **`src/features/applications`** — the admin review: `ApplicationsPage` (`/admin/applications`, under _More_; status chips, oldest waiting first), `ApplicationDetailPage` (`/admin/applications/:id`; warnings, the decision buttons, and after a decision the WhatsApp message built by `whatsapp.ts` from `lib/whatsapp.ts` in the parent's language), `AcceptApplicationDialog`, `RejectApplicationDialog`, `RegistrationLinkButton` (copies `<origin>/register`), `usePendingApplicationCount()` (the count for the home card and the menu badge; refreshed by the live feed and every minute).
- **Live updates:** an `application.submitted` entry arrives through the same Realtime channel as the feed (`useActivityRealtime` also refreshes `['applications']`), so a new request appears on an open list without reloading.
- **Menu badge:** `NavItem.badge` + `useNavBadges` (`src/app/`) put a count on the _Registrations_ entry, and on the phone's _More_ tab.
- **Security surface:** the form talks only to Supabase (the CSP is unchanged; a browser test proves nothing is blocked); `anon` can execute two functions and touch no table.
- **Tests:** `src/test/applications.ts` (`fakeApplication`); the e2e mock knows the two public functions, the review view, the decision functions and can fail the next submission (`world.failNextSubmit`).
