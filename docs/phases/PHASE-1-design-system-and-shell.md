# Phase 1 — Design system & app shell

**Status:** Not started · **Requirements:** R-05, R-14, R-15

## Goal

A beautiful, mobile-first, fully bilingual UI foundation: tokens, reusable components, admin and coach layouts, routing, and a static login screen. **No backend yet** — screens use static/mock content.

## Read first

[06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md), [03-architecture.md](../03-architecture.md) (routing/layouts)

## Tasks

- [ ] Install Radix primitives needed (Dialog, Select, Tabs, Toast, Popover, Switch, Checkbox, DropdownMenu, Slot) and `class-variance-authority` if used for variants
- [ ] Add design tokens/utilities not yet present (focus ring, safe-area helpers, `shield` clip-path utility, pitch-line background pattern)
- [ ] `LanguageToggle` component; persist language; sync `<html lang dir>` (already in `lib/i18n.ts`)
- [ ] UI kit in `src/components/ui`: Button, IconButton, Input, Textarea, Select, Switch, Checkbox, Field, Card, StatCard, Badge, Avatar (shield fallback), DataList (table ≥ md / cards < md), Dialog/Sheet, Toast, EmptyState, Skeleton, Tabs, PageHeader
- [ ] Layouts: `AuthLayout` (pitch-line hero + logo), `AdminShell` and `CoachShell` (navy sidebar on ≥ md, top bar + bottom tab bar on phones, "More" sheet for admin overflow)
- [ ] Router (`react-router-dom`) with placeholder pages for the nav destinations in both shells; `/login` static form (email/password, language toggle, no submit logic)
- [ ] A dev-only "Design gallery" route (`/dev/ui`) showing every component in AR/EN, light states, to review visually
- [ ] i18n: `nav`, `auth` namespaces; **test that `ar` and `en` key sets are identical** across all namespaces
- [ ] Lint guard for physical-direction Tailwind classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l/r`) — e.g. an ESLint `no-restricted-syntax` rule on class strings or a Vitest grep test over `src/`
- [ ] Component tests: Button loading/disabled, Field error wiring, DataList responsive rendering, LanguageToggle flips `dir`

## Acceptance criteria

- At 390px width: no horizontal scroll; bottom tab bar visible; sidebar hidden. At ≥ 768px: sidebar visible on the start side (right in Arabic, left in English).
- Toggling language switches text, fonts, direction, sidebar side and directional icons without a reload.
- Design gallery shows all components with correct focus rings, 44px hit areas, and brand colors; no hard-coded hex in components.
- Login screen matches the brand (navy/blue hero, pink accent, shield logo) in both languages.
- `typecheck`, `lint`, `test`, `build` pass; docs updated.

## Out of scope

Supabase, real auth, real data, charts (Phase 6).

## Handoff notes

_(fill in when done: component list, tokens added, gotchas, screenshots/paths to review)_
