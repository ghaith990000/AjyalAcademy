# Phase 1 — Design system & app shell

**Status:** Done · **Requirements:** R-05, R-14, R-15 (foundation; verified again in Phase 8)

## Goal

A beautiful, mobile-first, fully bilingual UI foundation: tokens, reusable components, admin and coach layouts, routing, and a static login screen. **No backend yet** — screens use static/mock content.

## Read first

[06-design-system.md](../06-design-system.md) (see "As built (Phase 1)"), [07-i18n.md](../07-i18n.md), [03-architecture.md](../03-architecture.md) (routing/layouts)

## Tasks

- [x] Install Radix primitives (unified `radix-ui` package) and `class-variance-authority`
- [x] Design tokens/utilities: focus ring, safe-area helpers (`pt-safe`, `pb-safe`), `pitch-lines` background, animations, extra status tints. _Deviation:_ the shield is an SVG component (`Shield`), not a CSS clip-path (D-029)
- [x] `LanguageToggle` component; language persisted (`ajyal.lang`); `<html lang dir>` sync
- [x] UI kit in `src/components/ui`: Button, IconButton, Input, Textarea, Select (native), Switch, Checkbox, Field, Card, StatCard, Badge, Avatar, Shield, DataList, Dialog (sheet on phones), Toast, EmptyState, Skeleton, Tabs, PageHeader, HeroCard, BrandLogo, LanguageToggle
- [x] Layouts: `AuthLayout`, `AppShell` → `AdminShell` / `CoachShell` (navy sidebar ≥ md; app bar + bottom tab bar on phones; "More" sheet for admin overflow)
- [x] Router (`react-router-dom`) with placeholder pages for every nav destination in both shells; static `/login`
- [x] Dev-only design gallery at `/dev/ui`
- [x] i18n namespaces `common`, `ui`, `nav`, `auth`, `home`, `dev`; typed keys; **ar/en key-parity test**
- [x] Guard against physical-direction Tailwind classes (Vitest test scanning `src/`, D-028)
- [x] Component tests: Button (loading/disabled/asChild), Field (a11y wiring), Input (`ltr`), DataList (both layouts, keyboard, empty, loading), LanguageToggle (flips dir), Dialog (open/close/labels), Avatar, route/shell tests (AR default, EN switch, admin vs coach nav, 404)

## Acceptance criteria — results

- 390px: no horizontal scroll, tab bar visible, sidebar hidden ✅ · 1280px: sidebar visible on the start side (right in Arabic, left in English) ✅ — measured with real Chrome (`scrollWidth === clientWidth` on login, admin home, coach home, gallery, in both languages and both widths); no console errors.
- Language toggle switches text, font, direction, sidebar side and directional icons (chevrons, sign-out arrow, back arrow) without reload ✅
- Design gallery shows every component; hex colors appear only in the theme file ✅
- Login matches the brand (navy hero + pitch lines, pink accent line, logo, blue CTA) in both languages ✅
- `typecheck`, `lint`, `test` (35 tests), `build` pass ✅

## Handoff notes (for Phase 2+)

- **Where things are:** UI kit `src/components/ui` (+ `index.ts` barrel); shells `src/app/layouts`; nav data `src/app/nav.ts`; routes `src/app/routes.tsx`; placeholder pages `src/app/PlaceholderPage.tsx`; home preview `src/features/home/HomePage.tsx`; login `src/features/auth/pages/LoginPage.tsx`; gallery `src/features/dev/GalleryPage.tsx`.
- **Phase 2 must:** wrap `/admin` and `/coach` in role guards, make the login form real (remove the dev-only preview buttons or keep them behind `import.meta.env.DEV`), replace the `coaches` placeholder, add TanStack Query + Auth providers to `providers.tsx`, and put the user's name in the sidebar/app bar (currently shows the role label).
- **Not built (use native controls):** `DatePicker`/`TimePicker` — use `<Input type="date|time">` inside `Field` (16px text, correct `inputMode`); `Popover`/`DropdownMenu` — add when a screen needs them.
- **Money in RTL:** wrap `formatBHD(...)` in `<bdi>` (see the gallery `StatCard`).
- **Testing responsive UI:** jsdom cannot evaluate media queries, so component tests assert both layouts render and the responsive classes exist. Real layout checks were done by driving Chrome with `playwright-core` from a scratch folder (system Chrome, no browser download): visit each route at 390×844 and 1280×800 with `localStorage['ajyal.lang']` set to `ar`/`en`, compare `scrollWidth`/`clientWidth`, and screenshot. Phase 8 adds Playwright to the repo formally.
- **Gotchas:** newer ICU inserts a narrow no-break space in `Intl` time output — `formatTime` normalizes it. `Dialog` needs a `title` (a11y) and passes `aria-describedby={undefined}` when there is no description. Tab labels use `tabLabel` when the full label is too long (D-027).
- **Open items unchanged:** logo is still the 320px JPG (Q-006); fee/permission questions Q-001…Q-004 still open before Phase 4.
