# Phase 0 — Docs & scaffold

**Status:** Done (awaiting owner review) · **Requirements:** R-13, R-16, base of R-14

## Goal

Create the documentation set that governs the project and a minimal, green, branded React + TypeScript scaffold with i18n and testing wired up.

## Read first

[00-INDEX.md](../00-INDEX.md), [03-architecture.md](../03-architecture.md), [09-conventions.md](../09-conventions.md)

## Tasks

- [x] Research Ajyal Academy branding (no public palette; derive from the supplied logo — see [06-design-system.md](../06-design-system.md))
- [x] Write `CLAUDE.md` and `docs/00…09`, `ROADMAP.md`, and one file per phase
- [x] Scaffold Vite + React 19 + TypeScript (strict), path alias `@/`
- [x] Tailwind CSS v4 with brand tokens in `src/styles/index.css`
- [x] i18next with `ar` (default, RTL) / `en`, `<html lang dir>` sync (`src/lib/i18n.ts`)
- [x] `src/lib/money.ts` (fils ⇄ BD, formatting) with unit tests
- [x] ESLint (flat), Prettier, Vitest + Testing Library + jest-dom
- [x] Blank branded page (logo, name, tagline, language toggle) with tests for AR/RTL default and EN/LTR switch
- [x] Copy logo to `public/brand/logo.jpg`; `.env.example`, `.gitignore`

## Acceptance criteria

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass ✅
- `npm run dev` shows the branded page in Arabic/RTL, toggles to English/LTR ✅
- Every original requirement is traceable in [02-requirements.md](../02-requirements.md) ✅

## Files created

`CLAUDE.md`, `docs/**`, `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/lib/{i18n,money,utils}.ts`, `src/locales/{ar,en}/common.json`, `src/styles/index.css`, `src/test/setup.ts`, `public/brand/logo.jpg`.

## Handoff notes

- Stack versions are the latest at scaffold time (see D-025). Tailwind v4 uses `@theme` in CSS — there is **no** `tailwind.config.js`.
- `App.tsx` is a placeholder; Phase 1 replaces it with the router + shells.
- Only the `common` i18n namespace exists; add namespaces per feature and register them in `src/lib/i18n.ts`.
- Git repo initialized on `main` with remote `origin` = `git@github.com:ghaith990000/AjyalAcademy.git`. Radix, `vite-plugin-pwa`, and Playwright are **not installed yet** — install them in the phase that first needs them (Radix: Phase 1, PWA/Playwright: Phase 8).
- Open questions Q-001…Q-007 in [08-decisions.md](../08-decisions.md) are unanswered; placeholders are documented.
