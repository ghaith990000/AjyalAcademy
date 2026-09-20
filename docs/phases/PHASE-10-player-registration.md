# Phase 10 — Public player registration

**Status:** Done — automated and browser checks complete; the owner's live check is pending · **Requirements:** R-18

## Goal

Parents register their children through a public form — **no login** — and an admin accepts or rejects each application. Accepting creates the player.

## Read first

[04-data-model.md](../04-data-model.md) (`players`, RLS matrix), [05-business-rules.md](../05-business-rules.md#player-rules), [06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md); Phase 9 ([PHASE-9](PHASE-9-locations.md)) — the form asks for a location.

## Decisions taken with the owner (2026-09-20)

- **Up to 4 children in one submission** (one parent contact, "Add another child"); each child is its own application, accepted or rejected on its own.
- **The parent is told by the admin, not by the app.** The app has no email/SMS service, so after a decision the admin sees a **Message on WhatsApp** button (opens `wa.me` with the parent's number and a ready message in the parent's language). Automatic email is a later feature.

## Design (Claude's defaults — change freely)

- **Write-only door.** The public form calls one `SECURITY DEFINER` function, `submit_player_applications`, granted to `anon`; `anon` has **no table access at all** and cannot read anything back. A second function, `public_locations()`, lists the active locations for the form's picker.
- **No oracle.** The form never says "this CPR already exists". The admin sees the warning on the application ("a player with this CPR already exists" / "another pending application has this CPR").
- **Spam defences without a captcha:** a hidden honeypot field (answered with a fake success), field length limits in the database, at most 5 submissions per phone number per day and a global ceiling per hour (D-090). A captcha (Turnstile) can be added later if abuse appears.
- **Review** (`/admin/applications`, admin only): Pending / Accepted / Rejected. **Accept** creates the player (coach optional — assigned later or right there), keeping the parent's name and the chosen location; **Reject** takes an optional internal note. Decisions are final (a rejected parent can submit again). Everything is logged; a new submission shows in the live feed and as a card on the admin home.
- A player gets a new optional `guardian_name` (the parent's name), so accepting loses nothing.

## Tasks

- [x] **Migration:** `players.guardian_name`; enum `application_status`; table `player_applications` (RLS: admins read, nobody writes directly); `submit_player_applications`, `public_locations`, `accept_player_application`, `reject_player_application`; activity actions `application.submitted|accepted|rejected`; pgTAP `08_applications.test.sql` (incl. the `anon` grants and limits)
- [x] **Public form** `/register` (no login, own light layout with the language switch): parent name + phone + location, 1–4 child cards (name, CPR, date of birth, address, school, illness), a confirmation checkbox, a thank-you screen; validation as the player form; works offline-tolerant (clear error, nothing lost)
- [x] **Applications page** (admin): list with status chips and a count of pending, detail sheet, accept dialog (coach + location), reject dialog, duplicate warnings, WhatsApp message button after a decision
- [x] Admin home card "N registration requests waiting"; a count on the navigation entry; the live feed sentences; realtime refresh when a request arrives
- [x] Player form / detail show the guardian's name; `guardian_name` in the CSV-free places only (no export change)
- [x] i18n (`applications`, `register` namespaces), Vitest, e2e (public form in ar + en, admin accepts and rejects), audit routes, CSP check (the form talks only to Supabase), docs (`04`, `05`, `07`, `08`, `10`, `11`, requirements, roadmap)

## Acceptance criteria — results

- [x] **A parent with no account can submit 1–4 children in Arabic or English on a phone; the admin sees them without reloading** — browser tests (a parent registers two children in both languages; a request pushed through the live channel appears on the open list); unit tests for the form (validation, up to four cards, duplicate CPRs, condition needs a description, failed sends keep the answers and the submission id).
- [x] **`anon` can call only the two public functions; it cannot select, insert, update or delete `player_applications` or any other table** — pgTAP `08` (139 assertions, on the hosted project, rolled back) and the privilege audit in `01`/`07`; the request shapes were also sent to the hosted PostgREST as `anon` (reads of the table, the view, `players`, a direct insert and both decision functions are all refused with 42501/401; `public_locations` answers; the honeypot answers 204 and stores nothing; a bad phone, no children, five children, an unknown location and a bad CPR come back as `ajyal:*` errors; the live tables held no application afterwards); and a read-only check on the hosted schema after applying: no table without RLS, no `anon` table privilege, `anon` executes exactly `public_locations` and `submit_player_applications`, `authenticated` can delete only `expenses`.
- [x] **Accepting creates exactly one player with the request's data and marks it accepted; a taken CPR is refused with a clear message; a decided request cannot be decided again** — pgTAP (data copied, coach/location as chosen, `created_by`, one feed entry and no extra `player.created`, `cpr_taken` with the player's id in DETAIL, a removed player's CPR does not block, `already_decided` both ways) and browser/unit tests of the dialogs.
- [x] **Coaches cannot see applications** — pgTAP (no rows in the table, the view or the feed; both decision functions refuse) and the App test (no menu entry, the count is never asked for).
- [x] `typecheck`, `lint`, `test` (803), `build`, `e2e` (146) pass; pgTAP passes on the hosted project, rolled back: `08` (139) in full and the changed audit assertions of `01`/`07`; advisors: the two intentional `anon` notes and the existing intentional ones.
- [ ] **Owner's live check:** open `/register` on a real phone, send a test request, accept it, press **Message on WhatsApp**.

## Out of scope

Email / SMS / push notifications, a captcha, editing an application before deciding, re-opening a decision, deleting applications (retention of rejected applications is Q-010), parent accounts or a status-tracking page, documents and photos.

## Handoff notes

- **The database was migrated on the hosted project on 2026-09-20** (file `20260920110000_player_applications.sql`; recorded there as `player_applications`). Deploy the website from this commit or later to get `/register`; an older website simply has no such page.
- **The link to give parents** is `<site address>/register`; admins copy it from **More → Registrations → Copy registration link**, and the sign-in page links to it.
- **Before sharing the link, switch off the test locations** (Phase 9 handoff): the parents' location picker lists every _active_ location, and on the live project that still includes `dafsa`, `fsdfs`, `fsdfsfs` and `Udhhdhd`.
- **What the owner will see first:** an empty _Registrations_ page ("No requests waiting"). Test requests can be rejected but never deleted (Q-010).
- **Where things are:** SQL `supabase/migrations/20260920110000_player_applications.sql`, `supabase/tests/database/08_applications.test.sql`; TS `src/features/register` (form), `src/features/applications` (review), `src/lib/whatsapp.ts`, `src/app/layouts/PublicLayout.tsx`, `src/app/useNavBadges.ts`, `src/features/home/PendingApplicationsCard.tsx`; test helpers `src/test/applications.ts`, e2e mock `e2e/support/mock-api.ts`. Docs: `04` "As built (Phase 10)", `05` "Registration requests", `03`, `06`, `07`, `09`, `10`, `11`; decisions D-090…D-095, Q-010.
- **Gotchas:** the generated types cannot express a NULL for a function argument without a default, so `applications/api.ts` and `register/api.ts` cast (`orNullArg`); the accept dialog sends exactly what was chosen (no "default to the request's location" magic in SQL); a WhatsApp link needs the phone as digits with the country code (`lib/whatsapp.ts` adds 973 to an 8-digit number); supabase-js returns a failed fetch as an error object (D-095); the honeypot input must stay `aria-hidden` with `tabIndex={-1}` or axe flags it; in pgTAP, `today_bh()` is not callable as `anon` (only inside the definer function).
- **Known limits (by design):** no captcha (D-090) and no automatic message to the parent (D-093); a request cannot be edited before it is decided; a decision cannot be undone; rejected requests stay forever (Q-010); the per-phone limit can be used to lock out one specific number for a day; a parent cannot check the status of their request.
- **Verified in the browser** at 390px in Arabic and English: the form (empty, with errors, four children), the thank-you screen, the sign-in link, the requests list, a request with both warnings, an accepted request with its WhatsApp message, the accept dialog, the home card and the menu badge. Screenshots led to three fixes: a Latin child name in an Arabic card was cut at the wrong end, the Arabic warning badge wrapped, and the phone placeholder read backwards in Arabic.
