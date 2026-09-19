# Ajyal Academy — instructions for Claude

Bilingual (Arabic RTL / English) React + TypeScript + Supabase management app for Ajyal Academy, a youth football academy in Bahrain. Users: **admins** and **coaches**. Mobile-first.

## Start here (every session)

1. Read [docs/00-INDEX.md](docs/00-INDEX.md) — the map of all documentation.
2. Read [docs/ROADMAP.md](docs/ROADMAP.md) to find the **current phase**, then open that phase's file in `docs/phases/`.
3. Read only the reference docs that phase points to (data model, business rules, design system, i18n).

**The docs are the source of truth.** If code and docs disagree, do not silently pick one: fix whichever is wrong and record why in [docs/08-decisions.md](docs/08-decisions.md). Never build ahead of the current phase.

## Commands

```bash
npm run dev          # Vite dev server
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run build        # typecheck + production build
npx supabase start   # local Supabase (Docker, optional — dev uses the hosted project, D-030)
npx supabase db reset  # re-apply migrations + seed (local only)
npx supabase test db   # pgTAP DB tests; hosted: see docs/09-conventions.md
```

A phase is only done when `typecheck`, `lint`, `test` (and `build`) pass.

## Hard rules

- **Money is integer fils** (1 BD = 1000 fils). Never floats. Use `src/lib/money.ts`. Subscription totals come from `calcSubscriptionTotal` (TS preview) and the SQL function (authoritative) — see [docs/05-business-rules.md](docs/05-business-rules.md).
- **RTL-safe CSS only**: logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Never `left/right/ml/mr/pl/pr/text-left/text-right`. Icons that imply direction must flip in RTL.
- **No hard-coded UI strings.** Every string is an i18n key present in both `src/locales/ar` and `src/locales/en`. Keys are type-checked from the English files; new namespaces go in `src/lib/i18n-resources.ts`. `npm test` fails on ar/en key drift and on physical-direction classes.
- **Mobile first.** Design at 390px, then scale up. No horizontal page scroll. Tap targets ≥ 44px.
- **Brand tokens only** (Tailwind theme in `src/styles/index.css`). No ad-hoc hex colors in components.
- **Every table has RLS.** New table ⇒ policies + an RLS test. Coaches must never read other coaches' data.
- **`activity_log` is written server-side only** (triggers/RPCs), never by the client.
- **Soft delete** players and subscriptions (`deleted_at` / `cancelled_at`); financial history must survive.
- Composite writes (subscription + players + payment, attendance) go through a single **Postgres RPC** (one transaction).
- Prefer editing existing files and reusing `src/components/ui/*` (see "As built" in [docs/06-design-system.md](docs/06-design-system.md)) over adding new abstractions. Wrap every form control in `Field`. Review UI changes in the dev gallery at `/dev/ui`.

## Definition of Done (each phase)

Code + tests pass · phase file checklist ticked · [docs/ROADMAP.md](docs/ROADMAP.md) updated · new decisions logged in `08-decisions.md` · `04-data-model.md` / `05-business-rules.md` / `06-design-system.md` / `07-i18n.md` updated if touched · verified in a browser at 390px in **both** Arabic and English.
