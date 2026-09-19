# Phase 8 — Polish & release

**Status:** Done — automated and browser checks complete; the owner's checks on a real phone and the real project are pending (listed below) · **Requirements:** verification of R-05, R-14, R-15

## Goal

Make it production-ready: installable on phones, accessible, resilient, tested end to end, and deployable, with documentation audited.

## Read first

[06-design-system.md](../06-design-system.md#mobile-checklist-run-for-every-screen), [07-i18n.md](../07-i18n.md#rtli18n-checklist-per-screen), [09-conventions.md](../09-conventions.md)

## Tasks

- [x] **PWA:** `vite-plugin-pwa` — manifest (name in both languages, `theme_color #1860C8`, icons generated from the logo incl. maskable), offline app shell, update prompt, install hint (Android button, iPhone Share-sheet steps) — D-074, D-075
- [x] **Accessibility pass:** an axe (WCAG 2.1 A + AA) sweep of every screen for both roles in both languages at 390px, plus the main dialogs and the phone menu; brand contrast pairs measured and the failing ones fixed (D-078); tap targets ≥ 44px enforced by the same sweep; keyboard names, roles, headings and landmarks fixed (D-079); reduced motion was already global
- [x] **Resilience:** root error boundary and router error screens (with a page-download-failed wording), offline banner, session-expiry handling (any rejected login ends the session, and the login screen explains), translated error mapping already in place — D-076, D-077
- [x] **Performance:** every page loaded on demand (main bundle 1.13 MB → 633 kB, 195 kB gzipped), charts in their own chunk, self-hosted fonts, a splash before the first paint; Lighthouse (mobile, throttled) — see results
- [x] **Playwright** e2e (`npm run e2e`, 103 tests): sign-in as admin and coach, add a player, create a subscription, take attendance, the admin reports, the live feed, PWA installability and offline, the Content-Security-Policy, and the audit sweep — in `ar` and `en` at 390px — D-081
- [x] **RTL/mobile audit** of every screen: done by the sweep above (direction attributes, no sideways scroll, tap targets, mirrored navigation order); it found and fixed the real problems listed under "Found and fixed"
- [x] Optional dark mode: **not built** (not requested; D-083)
- [x] **Deploy guide** [10-deployment.md](../10-deployment.md): the Supabase project, migrations, sign-in settings, the Edge Function, the first admin, Vercel / Netlify (`vercel.json`, `netlify.toml`), security headers, smoke test, updates, backups and restore, troubleshooting, a go-live checklist
- [x] **User guide** [11-user-guide.md](../11-user-guide.md) (English and Arabic) for coaches and admins, with the app's exact button names
- [x] **Docs audit:** every doc re-read against the code — folder layout, stack table, routing, fonts, namespaces, test tables and commands corrected; requirements R-01…R-16 all `[x]`; ROADMAP all Done; the new docs added to `00-INDEX.md`

## Acceptance criteria — results

- [x] **The app installs to a phone home screen and launches standalone with the Ajyal icon** — as far as a machine can check: the manifest is valid (standalone, both names, 192 / 512 / maskable icons that all load), Chrome's installability check reports nothing (`Page.getInstallabilityErrors`), the service worker takes control, and the app shell opens offline with the offline strip. _Owner's check: actually add it to a real Android and a real iPhone home screen._
- [x] **The Playwright suite passes for both languages at mobile width** — 103 of 103 (`npm run e2e`), plus the axe audit inside it.
- [x] **No open accessibility blockers; Lighthouse targets met** — Lighthouse 13, mobile emulation with the default throttling, on the built login page: **Accessibility 100**, **Best Practices 100**, **Performance 81 / 89 / 92** in three runs (median ≈ 89; the score moves with machine load — target ≥ 85), SEO 66 on purpose (the site is `noindex` and `robots.txt` disallows all: it is private). Authenticated screens cannot be Lighthouse-tested without a login; the axe sweep covers them instead.
- [x] **A new developer (or Claude) can deploy from `10-deployment.md` alone** — it starts from an empty Supabase project and ends with a smoke test and a go-live checklist. _Owner's check: follow it once for real._
- [x] `typecheck`, `lint`, `test` (662), `build`, and `e2e` (103) all pass; pgTAP (434 assertions from Phases 2–6) was not re-run because this phase changes no database object.

### Found and fixed (real problems the new checks caught)

- A **coach on a phone could not sign out** — the menu holding "Sign out" only existed when there were extra pages. The phone menu now always exists (and shows who is signed in).
- On the **login screen in English the language button could not be tapped** — the logo block sat on top of it (jsdom has no hit-testing, so unit tests never saw it).
- **Session expiry did nothing on most screens** — screens that draw their own errors were exempt from the sign-out; the person just saw "couldn't load" and a Retry that could never work.
- **Low contrast** on warning, success and pink text in badges and tags (3.3–4.4:1).
- **24px tap targets:** checkboxes, the wizard's player rows, player names on the subscription page, the phone link on the player page (the Phase 3 leftover).
- **Invalid ARIA:** the report's Month/Year switch was tabs without panels; a definition list had wrapper divs; a scrolling table had no keyboard access; a clickable card contained a checkbox; the not-found page had no `h1`; the login screen had no `main`.
- **`eval` under the Content-Security-Policy** — zod compiles validators with `new Function`; switched off.
- An empty Arabic `dir="auto"` field put its placeholder on the wrong side (Phase 5 leftover): fixed globally.

## Out of scope

New features. Anything discovered goes into the backlog below.

## Backlog (post-release ideas, not committed)

Late/excused attendance, parent portal, WhatsApp reminders for expiring subscriptions, per-branch reporting, refunds, multi-coach players, Hijri dates. From this phase: dark mode; per-language resource loading and splitting the UI primitives (Radix) for a smaller first download; queueing writes while offline (needs a conflict story — D-075); an error-reporting service (errors are only logged to the browser console today); a better logo file for sharper icons (Q-006).

## Handoff notes

- **The project is feature-complete for the roadmap.** What is left is _operating_ it: the owner's checks below, then deployment per [10-deployment.md](../10-deployment.md).
- **Owner's checks (need a real phone and the real project):**
  1. Sign in as a real admin and a real coach; add a player as the coach and watch the admin's home feed show it within seconds (the **Live** badge on).
  2. Install to the home screen on Android and on iPhone; open with no connection; accept an update when one is offered.
  3. Open a generated payments CSV in Excel: Arabic names and amounts should look right.
  4. Answer Q-007 / Q-008 (host, and a separate production project) and Q-009 (coaches' manual discounts) — the defaults are in use — and Q-006 (a sharper logo).
  5. Turn on **leaked-password protection** and **disable sign-ups** in the Supabase dashboard (deployment guide §3).
- **Where things are:** `src/app/pwa`, `src/app/ErrorScreen.tsx` + `AppErrorBoundary.tsx` + `RouteErrorPage.tsx`, `src/features/auth/{sessionNotice,endSession}.ts`, `src/lib/{useOnline,zod-config}.ts`, `vite.config.ts` (PWA + CSP), `pwa-assets.config.ts`, `vercel.json`, `netlify.toml`, `e2e/` (specs and `support/mock-api.ts`). Architecture: `03-architecture.md` → "As built (Phase 8)"; conventions for the browser tests: `09-conventions.md` → "End-to-end tests".
- **Adding a screen or a query later:** teach the mock API about any new request (`e2e/support/mock-api.ts`) — the audit fails on requests it does not recognise — and add the route to `ADMIN_ROUTES` / `COACH_ROUTES` in `e2e/audit.spec.ts`. If the app must talk to a new origin, add it to the Content-Security-Policy in three places (`vite.config.ts`, `vercel.json`, `netlify.toml`).
- **Gotchas:** the service worker is blocked in most browser tests (it would hide requests from the mock) and allowed only in `pwa.spec.ts`; Chrome reports `in-incognito` in a test browser, which is the browser, not the app; the mock seeds the signed-in session once per tab (`sessionStorage` marker) so a sign-out or language change survives a reload; a `role=button` card must not contain another control; a positioned sibling paints over an earlier absolutely-positioned one unless it has a `z-index` (that hid the login language button); `getByRole('button', { name })` in Playwright is a case-insensitive _substring_ match — pass `exact: true` when one name contains another ("Year" / "Previous year"); Lighthouse 13 has no PWA category any more (installability is checked with Chrome's own installability errors); running `npm run icons` rewrites the PNGs in `public/brand/` (commit the result).
- **Known limits (by design):** writes are not queued offline (D-075); errors are logged to the console only; the Lighthouse Performance score depends on the machine and network (81–92 here) and the first download is ~300 kB of JavaScript (gzipped) for the login screen; the app icons are enlarged from a 320px logo; the mock-API browser tests cannot show real row-level security or real Realtime delivery.
- **Pre-existing, not touched:** none left from earlier phases — the phone-link tap target and the Arabic placeholder alignment were fixed here.
