# Phase 11 — CPR documents & player photos

**Status:** Done — automated and browser checks complete; the owner's live check is pending · **Requirements:** R-19

## Goal

A parent may attach their child's CPR file (an image or a PDF) when registering; an admin, or the player's own coach, can add or replace a photo and a CPR file from the player's page. Both are private — visible only to whoever may already see that player (or, while a request is pending, to an admin only) — never public.

## Read first

[04-data-model.md](../04-data-model.md) (`players`, `player_applications`, RLS matrix), [05-business-rules.md](../05-business-rules.md#player-rules), [06-design-system.md](../06-design-system.md), [07-i18n.md](../07-i18n.md); Phase 10 ([PHASE-10](PHASE-10-player-registration.md)) — this phase extends the same public form and the same `player_applications` request.

## Decision taken with the owner (2026-09-25)

- **Attaching a CPR file on the public form is optional** — a parent without a scan or photo handy can still register; an admin can ask for it before accepting (D-097).

## Design (Claude's defaults — change freely)

- **One private Storage bucket, `player-files`.** Never public. Its `storage.objects` RLS mirrors `players` exactly: an admin reads any object, a coach only one a *player they own* points to; `anon` may only `INSERT` under `applications/…` and can never read anything back — the same write-only door as Phase 10 (D-091, D-096).
- **A file is an image (JPEG/PNG/WebP) or a PDF, 8 MB at most** — checked in the browser and enforced again by the bucket itself (D-098).
- **Uploading happens immediately, on its own** — picking a file uploads it and records its path (on the request, or straight onto the player); there is no separate "save" step, and a failed upload leaves the previous file (if any) exactly as it was.
- **A photo and a CPR file are added from the player's own page**, not the create/edit form — a brand-new player has no id yet (D-099).
- **Accepting a request never copies the parent's file.** The new player's `cpr_file_path` points at the exact object the parent uploaded; nothing is moved (D-100).
- **Known gap, accepted like Q-010:** a storage upload is not covered by `submit_player_applications`'s own rate limits, since it happens before that function is ever called — bounded only by the bucket's size/type limits (D-101).

## Tasks

- [x] **Migration:** bucket `player-files` (private, 8 MB, image/PDF only); `players.cpr_file_path` / `avatar_path`; `player_applications.cpr_storage_path`; `owns_player_file(name)` helper; four `storage.objects` policies (anon insert, authenticated insert, select, delete); `trg_players_guard` validates a file path (own folder or `applications/…`, and the object must exist); `submit_player_applications` accepts an optional `cpr_storage_path` per child (must be this submission's own upload); `accept_player_application` carries it onto the new player; pgTAP `09_uploads.test.sql`
- [x] **`FileSlot`** (`components/ui`): pick/replace/remove, client-side type/size check, an instant local preview (no round trip) right after uploading, a signed-URL preview for a path loaded from the server, a plain chip (not a broken image) for a PDF
- [x] Register form: an optional CPR-file slot per child, uploaded to `applications/<submission>/<child>-…`
- [x] Applications review: a read-only preview of the parent's attached file (a signed URL, admin only while pending)
- [x] Player page: a "Photo & CPR document" card (admin any player, a coach their own — RLS already decides who even sees the page), the header avatar shows the photo once set
- [x] CSP: `img-src` allows the Supabase host (a signed URL) and `blob:` (the local preview) — `vite.config.ts`, `vercel.json`, `netlify.toml`
- [x] i18n (`players`, `register`, `applications` additions), Vitest, e2e mock (`storage.objects` upload/sign) + audit routes + a CSP flow, docs (`02`, `04`, `05`, `06`, `07`, `08`, `10`, requirements, roadmap)

## Acceptance criteria — results

- [x] **A parent can attach a CPR file to a child without it being required; the file is uploaded to its own path before the request is sent** — browser test (both languages) asserting the uploaded path's shape and that the object exists in the mock's store; unit tests for `FileSlot` (pick, reject a bad type/size, replace, remove) and the register form (attaching a file, a too-large one shown as a translated error, submitting with none at all).
- [x] **`anon` may only `INSERT` under `applications/…`; it can read nothing back, not even what it just uploaded** — pgTAP `09` (anon insert under `applications/`, refused under `players/`, reads back nothing; an admin can see any application's file while a coach cannot; an admin can upload for any player, a coach only their own; not even the uploader can read their own upload before a player row points at it).
- [x] **A photo and a CPR file added straight onto a player are admin-any / coach-own, exactly like every other player field** — pgTAP `09` (a coach cannot see or upload into another coach's player's folder) and the browser tests (a coach adds a photo and a file to their own player).
- [x] **Accepting a request with an attached file gives the new player that same file, not a copy — and the coach it is assigned to can then see it** — pgTAP `09` and a browser test opening a request that already has one attached.
- [x] **The players guard trigger refuses a file path that was never uploaded, or that belongs to another player's folder** — pgTAP `09` (`ajyal:file_not_found`, `ajyal:invalid_file`).
- [x] `typecheck`, `lint`, `test` (828), `build`, `e2e` (153) pass; pgTAP passes on the hosted project, rolled back: `09` (39) in full, `08` (139) re-run unchanged; advisors: only the intentional `owns_player_file` SECURITY DEFINER note (alongside the existing ones) and the pre-existing leaked-password setting.
- [ ] **Owner's live check:** attach a CPR file while registering a test child; as admin, open the request and view the file; add a photo to an existing player and see it on their page.

## Out of scope

A document/photo gallery per player (one CPR file and one photo only), OCR or verification of a file's contents, cropping/editing an uploaded photo, deleting an application's own upload (it stays part of the request's permanent record, like the request itself — Q-010), automatic clean-up of storage a form left behind without finishing, a stronger rate limit on uploads themselves (D-101).

## Handoff notes

- **The database was migrated on the hosted project on 2026-09-25** (file `20260925120000_player_files.sql`; recorded there as `player_files`). Deploy the website from this commit or later.
- **What the owner will see first:** every existing player with no photo (the shield-and-initials avatar, as before) and no CPR file — nothing to do, it is purely additive. A test upload can be added and removed at will from a player's page; deleting the *file itself* only works through the app (admin/coach, their own player) — an application's own upload is never deletable, by design.
- **Where things are:** SQL `supabase/migrations/20260925120000_player_files.sql`, `supabase/tests/database/09_uploads.test.sql`; TS `src/lib/storage.ts`, `src/lib/useSignedFileUrl.ts`, `src/components/ui/FileSlot.tsx`; `src/features/register/{schema,api,RegisterPage}.tsx` (the per-child slot), `src/features/applications/ApplicationDetailPage.tsx` (the read-only preview), `src/features/players/{api,hooks,PlayerDetailPage}.tsx` (the "Photo & CPR document" card) and `src/components/ui/Avatar.tsx` (an optional `photoUrl`); e2e mock `e2e/support/mock-api.ts` (storage upload/sign/remove routes, `world.files`). Docs: `04` "As built (Phase 11)", `08` D-096…D-102.
- **Gotchas:** Supabase blocks every plain SQL `DELETE` on `storage.objects` ("Direct deletion... use the Storage API instead"), whoever runs it — the delete RLS policy exists (and the privilege audit checks it is there) but pgTAP cannot exercise it directly, only the e2e mock and a live check can; `storage.objects` keeps Supabase's own broad table grants (unlike the public schema, D-036 does not apply there) — RLS alone is the gate; a file input is itself exposed with an accessible role of "button", so a Playwright query by role+name can match both it and the visible button next to it — query the input by label and the button by its text; the CSP needs `blob:` (the local preview) as well as the Supabase host (a signed URL), in all three places the policy is written down.
- **Known limits (by design):** one CPR file and one photo per player, not a gallery; no OCR or content check on what was uploaded; a request's own uploaded file can never be deleted (Q-010's reasoning extended to files); upload attempts are not rate-limited the way form submissions are (D-101).
