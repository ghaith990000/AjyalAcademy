# Design system — "Ajyal"

Goal: a polished, sporty, trustworthy UI for admins and coaches that clearly belongs to Ajyal Academy, and works one-handed on a phone.

## Brand research

There is no published brand guide or website palette for the academy (only a Linktree, Snapchat and Instagram `@ajyal.bh`; other unrelated "Ajyal" academies exist in KSA/UAE). The theme is therefore **derived from the supplied logo** (`public/brand/logo.jpg`, 320px): a royal-blue field, a white **shield** with a magenta/pink outline, blue "AJYAL" lettering with pink "SPORTS", the blue "AFA" monogram, and a small football. Colors below were sampled from the image.

> Follow-up: ask the owner for a transparent PNG/SVG logo. Until then, the JPG is used inside a rounded/shield frame on light backgrounds.

## Tokens

Defined once in `src/styles/index.css` (`@theme`) and used via Tailwind utilities (`bg-brand-blue`, `text-ink-muted`, …). **No hex colors in components.**

| Token                            | Value                             | Use                                                                                                                      |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `brand-blue`                     | `#1860C8`                         | Primary actions, links, active states, chart primary series                                                              |
| `brand-blue-600`                 | `#144FA5`                         | Hover/pressed for primary                                                                                                |
| `brand-blue-50`                  | `#EAF1FC`                         | Tinted backgrounds, selected rows                                                                                        |
| `brand-navy`                     | `#0E2F6B`                         | Sidebar, top headers, hero panels, dark surfaces                                                                         |
| `brand-pink`                     | `#E02068`                         | **Accent**: highlights, active tab indicator, key CTA on hero, notification dot, chart secondary series                  |
| `brand-pink-50`                  | `#FDEBF2`                         | Accent tinted backgrounds                                                                                                |
| `brand-pink-700`                 | `#C4185A`                         | Pink **text** on light backgrounds (`brand-pink` itself is 4.0:1 on its tint; this is 5.1:1)                             |
| `surface`                        | `#FFFFFF`                         | Cards, inputs                                                                                                            |
| `page`                           | `#F3F6FC`                         | App background (cool blue-tinted grey)                                                                                   |
| `ink` / `ink-muted`              | `#10203F` / `#5B6B8A`             | Text                                                                                                                     |
| `line`                           | `#DDE5F3`                         | Borders, dividers                                                                                                        |
| `success` / `warning` / `danger` | `#0F6E50` / `#946200` / `#C62828` | Status only. **Pink is never used for errors/destructive** (too close to red) — danger always pairs color + icon + text. |

Contrast (checked in Phase 8, WCAG AA = 4.5:1 for text): `ink` 16:1 and `ink-muted` 5.4:1 on `surface` (5.0 on `page`, 4.7 on `brand-blue-50`); `brand-blue` 5.9:1 on `surface`; `success` 6.2:1 on `surface`, `warning` 5.2:1, `danger` 5.6:1, each ≥ 4.5:1 on its own `-50` tint; `brand-pink-700` 5.1:1 on `brand-pink-50`; white on `brand-blue` 5.9:1, on `brand-navy` 12.8:1, on `brand-pink` 4.6:1, on `danger` 5.6:1. Use `brand-pink` for fills, bars and indicators and `brand-pink-700` for pink text.

## Typography

- **Arabic:** Cairo. **English:** Poppins. Both are served with the app (`@fontsource`, imported in `main.tsx` — no third-party request, and they work offline); `html[dir=rtl]` uses Cairo first.
- Scale: page title 24–28/extrabold, section title 18/bold, body 15–16/regular, caption 13/medium. Never below 13px.
- Numbers (money, CPR, phone, dates) use **Latin digits** in both languages, `tabular-nums`, and are wrapped in `<bdi>` inside RTL text so they don't reorder.

## Shape, elevation, motion

- Radii: controls 12px (`--radius-control`), cards 16px (`--radius-card`), pills full.
- Shadow: soft blue-tinted `--shadow-card`. Borders `line` 1px preferred over heavy shadows.
- Motion: 150–200ms ease-out for hover/press/sheet transitions; respect `prefers-reduced-motion`.

## Identity motifs

- **Shield:** logo frame, player avatar fallback (initials inside a shield outline), empty-state illustrations.
- **Pitch lines:** subtle white line-art pattern (center circle/halfway line) at 6–10% opacity on the login hero and dashboard hero card.
- **Football icon** as a small accent (attendance, sessions), not decoration everywhere.
- Hero cards: navy → blue gradient with a thin pink accent line.

## Layout

- **Phone (< `md`, design width 390px):** top app bar (logo, page title, language toggle, avatar menu) + **bottom tab bar** (4–5 primary destinations, pink active indicator). Floating "+" for primary create action. Forms are full-screen sheets/pages, not small modals.
- **Tablet/desktop (≥ `md`):** left **navy sidebar** (logo, nav, user), content max-width ~1200px. In RTL the sidebar sits on the right (use `start-0`, `border-e`, etc.).
- Safe-area insets respected (`viewport-fit=cover`, `env(safe-area-inset-*)`) on the bottom bar.
- **No horizontal page scroll.** Wide data uses `DataList` (table ≥ `md`, cards < `md`).

### Navigation

| Admin                                                                                              | Coach                                        |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Home · Players · Subscriptions · Sessions · More (Coaches, Discounts, Expenses, Reports, Settings) | Home · My players · Sessions · Subscriptions |

## Components (`src/components/ui`)

Built on Radix primitives where a11y matters (Dialog/Sheet, Tabs, Switch, Checkbox, Toast). **`Select` is a native `<select>`** — the OS picker is the best phone UX and is RTL-safe for free.

`Button` (primary/secondary/ghost/danger, sizes, loading) · `IconButton` · `Input`, `Textarea`, `Select`, `DatePicker`/`TimePicker` (native inputs styled, `inputMode` set), `Switch`, `Checkbox`, `RadioCard` (plan picker) · `Field` (label + hint + error, wired to react-hook-form) · `Card`, `StatCard` · `Badge` (status colors) · `Avatar` (shield fallback) · `DataList` · `Dialog`/`Sheet` · `Toast` · `EmptyState` · `Skeleton` · `Tabs` · `LanguageToggle` · `PageHeader`.

Rules: every component supports RTL, focus-visible ring (`brand-blue`), min 44px hit area, and both languages' text lengths (Arabic can be longer/shorter — no fixed-width labels).

## Charts (Recharts)

Palette order: `brand-blue`, `brand-pink`, `brand-navy`, then tints. Revenue = blue, expenses = pink, profit = success green line. Always label axes with translated text, show values in BD with 3 decimals in tooltips, never rely on color alone (legends + patterns/labels). In RTL, mirror chart x-axis direction for time series only if the design reads better; default keep left-to-right time axis and document if changed.

## Mobile checklist (run for every screen)

- [ ] Works at 360–430px wide, no horizontal scroll
- [ ] Primary action reachable by thumb (bottom area)
- [ ] Inputs use correct `type`/`inputMode` (`tel`, `numeric` for CPR, `date`, `time`)
- [ ] Tap targets ≥ 44×44px, spacing ≥ 8px
- [ ] Loading, empty, error states present
- [ ] Verified in Arabic (RTL) **and** English

## As built (Phase 1)

Source of truth for what exists in `src/components/ui` (import from `@/components/ui/<Name>`; a barrel `index.ts` also exists).

- **Form:** `Button` (`primary | accent | secondary | ghost | danger`, sizes `md | lg | icon`, `loading`, `asChild`; variants live in `button-variants.ts`), `IconButton` (requires a translated `label`), `Input` (`ltr` prop forces LTR for emails/phones/CPR/codes, `endAdornment`), `Textarea` (`dir="auto"`), `Select`, `Switch`/`SwitchField`, `Checkbox`/`CheckboxField`, `Field` (render-prop; wires label, hint, error, `aria-invalid`, `aria-describedby`, `aria-required` to the control — **always wrap controls in `Field`**).
- **Display:** `Card`/`CardTitle`, `StatCard` (icon above text on phones), `Badge` (tones `neutral | info | accent | success | warning | danger`, always text + dot), `Avatar` (shield with initials), `Shield`, `HeroCard`, `EmptyState`, `Skeleton`, `PageHeader`, `BrandLogo`, `Tabs`.
- **Data:** `DataList<T>` — table from `md`, cards below; `columns` with one `primary` (card title) and optional `mobileHidden`; `onRowClick` makes rows keyboard-activatable; `loading` and `empty` states; `caption` is required (accessible name).
- **Overlays:** `Dialog` — bottom sheet on phones, centred from `md`; `fullOnMobile` for long forms; title required, description optional. `ToastProvider` + `useToast()` (from `toast-context.ts`): `toast({ title, description?, tone })`, always pass translated strings.
- **Money:** `Money` (`fils`) — an amount in BD / د.ب inside `<bdi>`; use it instead of calling `formatBHD` in JSX.
- **Language:** `LanguageToggle` (`tone="dark"` on navy).
- **Layouts:** `AppShell` (via `AdminShell`/`CoachShell`) — navy sidebar from `md`, navy app bar + bottom tab bar on phones, "More" bottom sheet for overflow items; `AuthLayout` for login. Navigation is data: `src/app/nav.ts`.
- **Shield motif** is the `Shield` SVG component (not a CSS clip-path). Pitch lines are the `pitch-lines` utility (use on an absolutely positioned child, because it sets `background-image`).
- **Tokens added beyond the table above:** `brand-navy-700`, `success-50`, `warning-50`, `danger-50`, `shadow-float`, animations `animate-fade-in | sheet-up | pop-in | toast-in`, utilities `pt-safe`, `pb-safe`. Focus ring is global (`:focus-visible`, brand-blue). `prefers-reduced-motion` is honoured globally.
- **Phone tab bar labels** may use a shorter key (`tabLabel`) because 13px text must fit ~78px: English "Billing" stands in for "Subscriptions" (Arabic keeps "الاشتراكات").
- **Radix direction:** `Providers` wraps the app in Radix `Direction.Provider` so keyboard navigation (tabs, etc.) follows RTL.
- **Dev gallery:** `/dev/ui` (development builds only) renders every component in the current language — use it to review any change to `components/ui` in both languages.
- Verified at 390px and 1280px in Arabic and English with real Chrome: no horizontal overflow on any screen.

## As built (Phase 5)

No new `components/ui` component. The **attendance screen** (`features/attendance/AttendancePage`) is the reference for a thumb-first list: each player is one full-width toggle button (`min-h-16` = 64px, `aria-pressed`, a check/cross icon **and** a "Present"/"Absent" label — never colour alone), live counts in a `role="status"` row, and a **sticky save bar** that sits just above the phone tab bar (`bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`, `md:bottom-0` on desktop). The sessions **agenda** is a plain list of cards grouped under day headings (not a `DataList`), with an "Attendance" shortcut on each session that has started. Verified at 390px and 1280px in Arabic and English (RTL mirroring, long Arabic and English names, dialogs inside the viewport).

## As built (Phase 6)

- **`PeriodSwitcher`** (`features/reports`): optional Month | Year tabs plus a bordered bar with previous / next `IconButton`s (chevrons flip in RTL) around the period name; "next" is disabled at the current period. Used by the reports page, the expenses page (month only) and the salary dialog.
- **Category chips** (`features/expenses/CategoryChips`): single-choice `aria-pressed` buttons, `min-h-11`, wrapping (never a sideways scroll).
- **Reports page:** a 2 × 2 grid of compact KPI cards on phones (4 across from `lg`); negative profit / margin in `text-danger` **and** signed. The chart (`RevenueChart`) uses the tokens through CSS variables (`--color-brand-blue`, `--color-brand-pink`, `--color-success`), has its own translated legend above it (bar, bar, line shapes), a left-to-right axis with month numbers 1–12 and integer BD ticks, a translated tooltip with the full month name and three `Money` lines, and `role="img"` with an `aria-label`; the **month table** underneath (12 rows + a year row, plain signed amounts, unit in the header) is the text alternative. `Money` puts a negative number in an LTR island (D-068).
- Verified at 390px and 1280px in Arabic and English (RTL mirroring, tooltip and dialogs inside the viewport, no horizontal scroll, tap targets ≥ 44px).

## As built (Phase 7)

- **`StatCard compact`:** the icon sits in the label row and the value goes underneath — about half the height of the default card, and a value such as `540.000 BD` fits a half-width card on a phone. Use it when several cards share a row (the home KPIs). The value area is a `div`, so a loading `Skeleton` can be passed without invalid nesting.
- **`FilterChips`** (`components/ui`): a labelled group of `aria-pressed` pills, `min-h-11`. `layout="wrap"` (default) flows onto more lines; `layout="scroll"` keeps one line that scrolls inside itself, with the next chip peeking in as the cue — used by the feed, where seven wrapped chips would take three rows of a phone screen. A scrolling child of a grid needs a `minmax(0, 1fr)` track (`grid-cols-1`) or it stretches the page sideways.
- **Home:** quick actions are three ≥ 80px tiles in one row (icon + short label, no tap target under 44px); today's sessions are cards with a full-width primary "Take attendance" button; the expiring list shows plan, "Ends tomorrow / in 5 days" and a warning badge for an unpaid balance. **Feed item:** a shield avatar with initials and a small round icon (colour by kind, never colour alone — the sentence says it too), the sentence with names in semibold, an optional muted detail line, the time. Verified at 390px and 1280px in Arabic and English (long Arabic and English names, mixed-script sentences, the live entry arriving, dialogs inside the viewport).

## As built (Phase 8)

- **Tap targets:** `Checkbox` is a 44px button drawing a 24px box (a `-m-2.5` margin keeps the layout of a 24px box). `FilterChips` are `min-h-11`; a `DataList` phone card that holds its own controls is not announced as one big button (`nestedControls`), because a button may not contain another control. The phone menu ("More", last tab, for coaches too) always exists — it holds Sign out and shows who is signed in.
- **Semantics the audit (axe, WCAG 2.1 A/AA) enforces:** one `h1` per screen (`EmptyState titleAs="h1"` for the not-found and crash screens), a `main` landmark on the login screen, `dl` rows as direct `div`s of `dt`/`dd`, a keyboard-focusable and named region around anything that scrolls sideways (the months table), and single-choice filters as `aria-pressed` buttons (`FilterChips`), not orphaned `tab`s.
- **Feedback strips:** `OfflineBanner` (warning tint, at the top of the shells and the login screen), `UpdatePrompt` (a card above the phone tab bar), `InstallHint` (a card on the home screen, phones only, dismissible).
- **Reduced motion** was already honoured globally (`prefers-reduced-motion` in `index.css`). **Dark mode** was not requested and is not built; the tokens are all in one place if it is wanted later.

## As built (Phase 9)

- **`LocationField` / `LocationSelect`** (`src/features/locations/LocationField.tsx`) wrap the native `Select` — the OS picker on phones, RTL-safe. Use `LocationField` (label, hint, error wired through `Field`) in forms and `LocationSelect` inside a `Field` for filters. Location names are data in either script: show them in `<bdi>` so a Latin name inside Arabic text (or the reverse) keeps its own direction.
- **Location tables** (`LocationBreakdown`) follow the months table: four columns that fit 390px, amounts in LTR islands, a focusable named region, a total row that equals the all-locations figures, a negative profit in the danger colour _and_ signed.

## As built (Phase 10)

- **`PublicLayout`** (`src/app/layouts/PublicLayout.tsx`) frames pages anyone can open: a navy brand bar with the language switch, a centred column of at most 42rem, a footer link to sign in. Use it for any future public page.
- **Repeating cards** (the registration form's children) are `Card`s with `role="group"` named by their heading; the remove button is an `IconButton` with its own label ("Remove child 2"). A hidden honeypot input sits in an `aria-hidden` zero-size box with `tabIndex={-1}`.
- **`CountBadge`** (in `AppShell`) is a pink pill (white on `brand-pink` is 4.59:1) whose number is `aria-hidden`; a screen-reader-only "N waiting" carries the meaning, and a real space separates it from the label so the name reads "Registrations 3 waiting".
- **Names in cards** (`dir="auto"` + `truncate`): a Latin name in an Arabic card is aligned and cut at its own end, not at the wrong one. A link inside a warning or an alert sits on its own line (`inline-flex min-h-11`) so it is a 44px target.
