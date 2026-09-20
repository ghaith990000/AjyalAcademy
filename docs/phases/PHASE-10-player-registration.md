# Phase 10 — Public player registration

**Status:** Not started · **Requirements:** R-18

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

- [ ] **Migration:** `players.guardian_name`; enum `application_status`; table `player_applications` (RLS: admins read, nobody writes directly); `submit_player_applications`, `public_locations`, `accept_player_application`, `reject_player_application`; activity actions `application.submitted|accepted|rejected`; pgTAP `08_applications.test.sql` (incl. the `anon` grants and limits)
- [ ] **Public form** `/register` (no login, own light layout with the language switch): parent name + phone + location, 1–4 child cards (name, CPR, date of birth, address, school, illness), a confirmation checkbox, a thank-you screen; validation as the player form; works offline-tolerant (clear error, nothing lost)
- [ ] **Applications page** (admin): list with status chips and a count of pending, detail sheet, accept dialog (coach + location), reject dialog, duplicate warnings, WhatsApp message button after a decision
- [ ] Admin home card "N registration requests waiting"; a count on the navigation entry; the live feed sentences; realtime refresh when a request arrives
- [ ] Player form / detail show the guardian's name; `guardian_name` in the CSV-free places only (no export change)
- [ ] i18n (`applications`, `register` namespaces), Vitest, e2e (public form in ar + en, admin accepts and rejects), audit routes, CSP check (the form talks only to Supabase), docs (`04`, `05`, `07`, `08`, `10`, `11`, requirements, roadmap)

## Acceptance criteria

- [ ] A parent with no account can submit 1–4 children in Arabic or English on a phone; the admin sees them without reloading
- [ ] `anon` can call only the two public functions; it cannot select, insert, update or delete `player_applications` or any other table (pgTAP + `anon` request-shape checks on the hosted project)
- [ ] Accepting creates exactly one player with the application's data and marks the application accepted; a taken CPR is refused with a clear message; a decided application cannot be decided again
- [ ] Coaches cannot see applications
- [ ] `typecheck`, `lint`, `test`, `build`, `e2e` pass; pgTAP passes on the hosted project (rolled back)

## Out of scope

Email / SMS / push notifications, a captcha, editing an application before deciding, re-opening a decision, deleting applications (retention of rejected applications is Q-010), parent accounts or a status-tracking page, documents and photos.

## Handoff notes

_(filled in when the phase is done)_
