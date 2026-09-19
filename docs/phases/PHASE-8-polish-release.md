# Phase 8 — Polish & release

**Status:** Not started · **Requirements:** verification of R-05, R-14, R-15

## Goal

Make it production-ready: installable on phones, accessible, resilient, tested end to end, and deployable, with documentation audited.

## Read first

[06-design-system.md](../06-design-system.md#mobile-checklist-run-for-every-screen), [07-i18n.md](../07-i18n.md#rtli18n-checklist-per-screen), [09-conventions.md](../09-conventions.md)

## Tasks

- [ ] **PWA:** `vite-plugin-pwa` — manifest (name AR/EN, `theme_color #1860C8`, icons generated from the logo incl. maskable), offline shell, install prompt hint on mobile
- [ ] **Accessibility pass:** keyboard nav, focus order, labels/aria (translated), contrast check of brand pairs (pink on white at small sizes), reduced motion, screen-reader labels on icon buttons
- [ ] **Resilience:** global error boundary, offline banner, retry on failed queries, translated Supabase error mapping, session-expiry handling
- [ ] **Performance:** route-level code splitting, image sizes, lazy chart bundle; check Lighthouse mobile (target: Performance ≥ 85, Accessibility ≥ 95)
- [ ] **Playwright** e2e (install now): at 390px in `ar` and `en` — login (admin/coach), add player, create subscription, take attendance, admin report loads; RTL screenshot checks of key screens
- [ ] **RTL/mobile audit** of every screen against the checklists; fix any physical-direction classes or overflow
- [ ] Optional: dark mode using the same tokens (only if requested)
- [ ] **Deploy guide** `docs/10-deployment.md`: hosted Supabase project (run migrations, deploy `create-coach`, set secrets), env vars, Vercel/Netlify SPA config (rewrite all to `index.html`), first-admin bootstrap, backups
- [ ] **User guide** `docs/11-user-guide.md` (short, EN + AR) for admins and coaches
- [ ] **Docs audit:** every doc matches the implemented system; requirements table all `[x]`; ROADMAP all Done; add new docs to `00-INDEX.md`

## Acceptance criteria

- App installs to a phone home screen and launches standalone with the Ajyal icon.
- Playwright suite passes in CI/local for both languages at mobile width.
- No open a11y blockers; Lighthouse targets met.
- A new developer (or Claude) can deploy from `10-deployment.md` alone.
- `typecheck`, `lint`, `test`, `build`, DB tests, and e2e all pass.

## Out of scope

New features. Anything discovered goes into a "Backlog" list appended below.

## Backlog (post-release ideas, not committed)

Late/excused attendance, parent portal, WhatsApp reminders for expiring subscriptions, per-branch reporting, refunds, multi-coach players, Hijri dates.

## Handoff notes

_(fill in when done)_
