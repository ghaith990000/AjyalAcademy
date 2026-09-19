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
| `surface`                        | `#FFFFFF`                         | Cards, inputs                                                                                                            |
| `page`                           | `#F3F6FC`                         | App background (cool blue-tinted grey)                                                                                   |
| `ink` / `ink-muted`              | `#10203F` / `#5B6B8A`             | Text                                                                                                                     |
| `line`                           | `#DDE5F3`                         | Borders, dividers                                                                                                        |
| `success` / `warning` / `danger` | `#12805C` / `#B7791F` / `#C62828` | Status only. **Pink is never used for errors/destructive** (too close to red) — danger always pairs color + icon + text. |

Contrast: body text on `page`/`surface` ≥ 4.5:1; white on `brand-blue`, `brand-navy`, `brand-pink` ≥ 4.5:1 (verify pink at small sizes; use ≥ 16px semibold or navy instead).

## Typography

- **Arabic:** Cairo. **English:** Poppins. Both loaded from Google Fonts in `index.html`; `html[dir=rtl]` uses Cairo first.
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

Built on Radix primitives where a11y matters (Dialog/Sheet, Select, Tabs, Popover, Toast).

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
