# Deployment guide

How to put Ajyal Academy on the internet and keep it running. You need this document and nothing else: it starts from an empty Supabase project and a Git repository and ends with an installable app that the academy's staff use.

**The shape of it:** the app is a static website (HTML, JS, CSS — the `dist/` folder) plus one Supabase project (database, sign-in, one Edge Function, realtime). There is no server of our own to run.

```
phones / laptops ──HTTPS──▶ static host (Vercel, Netlify, …)   serves dist/
        │
        └────────HTTPS + WSS────▶ Supabase project              Postgres (RLS), Auth, create-coach function, Realtime
```

## 0. What you need

- A **Supabase** account and a project (Free works to try; use Pro for daily backups and leaked-password protection — see §3 and §9).
- A **static host** account: Vercel or Netlify (config files for both are in the repo). Any host that can serve `dist/` with a "send every unknown path to `index.html`" rule works.
- **Node.js 22+** and **npm** (to build), and the **Supabase CLI** (`npx supabase …` is enough).
- A **domain name** on **HTTPS**. This is not optional: browsers only allow the service worker and "install to home screen" on HTTPS.

Decision Q-007 / Q-008 (which host, and whether production gets its own Supabase project) is still open; this guide works for either. **Recommendation:** give production its own Supabase project, separate from any project you test on, and apply the same migrations to both.

## 1. Create the Supabase project

1. In the Supabase dashboard: **New project**. Pick the region closest to Bahrain (for example Frankfurt or Mumbai), set a strong database password and keep it in a password manager.
2. From **Project Settings → API**, note three values:
   - **Project URL** — `https://<project-ref>.supabase.co`
   - **Publishable key** (`sb_publishable_…`; the older "anon" JWT also works) — this is the only key that goes to the browser.
   - **Project reference** (`<project-ref>`).
     Do **not** copy the `service_role` / secret key anywhere except where §4 says (Supabase already provides it to the Edge Function on its own).

## 2. Apply the database migrations

The files in `supabase/migrations/` (12 of them, in date order) are the whole database: tables, row-level security, triggers, functions, views and the realtime publication.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push          # applies every migration that has not run yet, in order
```

`db push` asks for the database password from step 1. Afterwards check in **Table Editor** that `profiles`, `players`, `plans`, `settings`, `subscriptions`, `payments`, `training_sessions`, `attendance`, `expenses`, `activity_log`, `discounts`, `locations` and `player_applications` exist and that each shows "RLS enabled". `plans` (four rows) and `settings` (one row) are created by the migrations, with the placeholder prices from `docs/05-business-rules.md`; you change them in the app's **Settings** page.

> **Upgrading an existing project to locations (`20260920100000_locations.sql`):** it turns the free-text session places into locations (one per distinct name), drops the old text column and requires a location on new sessions and subscriptions. It briefly switches one trigger off for the backfill, inside its own transaction. Do it **before** you deploy the new website (an older website would still send the removed column), and dry-run it first if you can — wrap the file's SQL in `begin; …; rollback;` and look at the result.

> **Upgrading an existing project to public registration (`20260920110000_player_applications.sql`):** purely additive (a column on `players`, one table, one view, four functions, one replaced trigger function). It opens two functions to the internet on purpose: `public_locations` and `submit_player_applications` are executable by `anon`, which is how a parent with no account sends the form; `anon` still has no access to any table. Apply it **before** deploying the website that has the `/register` page. The Supabase security advisor will list those two under _"Public can execute SECURITY DEFINER function"_ — that is intended.

> **Never run `supabase/seed.sql` on a real project.** It creates demo accounts with a published password (`Ajyal#Dev2026`). It is for a local Docker database only.

**Run the database tests once** against the new project if you can (`docs/09-conventions.md` → "Running the database tests"). Each file rolls back everything it does, so it is safe on a project that already has data.

## 3. Configure sign-in (Authentication)

In **Authentication → Providers → Email** and **Authentication → URL Configuration**:

| Setting                        | Value                      | Why                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email provider                 | Enabled                    | Staff sign in with email + password                                                                                                                                                                                               |
| **Allow new users to sign up** | **Off**                    | Accounts are created only by an admin (coaches via the app, the first admin by you in §5). With sign-up on, anyone could create an auth user; they would have no profile and could do nothing, but there is no reason to allow it |
| Confirm email                  | Off (or On if you want it) | Coaches are created already confirmed by the Edge Function                                                                                                                                                                        |
| Site URL                       | `https://<your-domain>`    | Where Supabase redirects to                                                                                                                                                                                                       |
| Redirect URLs                  | `https://<your-domain>/**` | Allow-list for redirects                                                                                                                                                                                                          |
| Minimum password length        | 8 or more                  | The Coaches form and the Edge Function already require 8–72 characters                                                                                                                                                            |
| **Leaked password protection** | **On** (Pro plan)          | Blocks passwords found in known breaches. This is the one Supabase advisor warning that stays open on the Free plan                                                                                                               |
| JWT expiry                     | 3600 s (default)           | The app refreshes it by itself; if a session is revoked the app sends the person to the login screen                                                                                                                              |

## 4. Deploy the `create-coach` Edge Function

Coaches are created from the app's **Coaches** page. That needs the service-role key, which must never reach the browser, so it runs in an Edge Function.

```bash
npx supabase functions deploy create-coach
```

- `supabase/config.toml` sets `verify_jwt = true` for it, so the platform rejects callers without a valid sign-in before the function even runs; the function then checks that the caller is an **active admin**.
- Supabase gives the function `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically. You set **no secrets** by hand.
- Check **Edge Functions → create-coach → Logs** after the first coach is created.

## 5. Create the first admin

There is deliberately no public way to become an admin. Do this once:

1. **Authentication → Users → Add user → Create new user.** Enter the owner's email and a strong password; tick **Auto Confirm User**.
2. **SQL Editor**, run (change the email and name):

   ```sql
   insert into public.profiles (id, full_name, email, role, active, preferred_language)
   select id, 'Owner Name', email, 'admin', true, 'ar'
   from auth.users
   where email = 'owner@example.com';
   ```

   It must report `INSERT 0 1`. (Zero rows means the email does not match.)

3. Sign in to the app with that account. From then on the admin creates **coaches** from the app's Coaches page. The app cannot create another **admin** (on purpose): repeat steps 1–2 with the other person's email.

A person whose auth user has **no profile** or an **inactive profile** cannot use the app: they are signed out straight away. To lock someone out, set **Active** off on the Coaches page (or `update public.profiles set active = false where email = '…'`).

## 6. Build and host the website

The app reads two values **at build time**:

| Variable                 | Value                           |
| ------------------------ | ------------------------------- |
| `VITE_SUPABASE_URL`      | the Project URL from §1         |
| `VITE_SUPABASE_ANON_KEY` | the **publishable** key from §1 |

They end up in the JavaScript that every visitor downloads — that is normal and safe for these two values; the security comes from row-level security in the database, not from hiding them. Put them in the host's **Environment Variables** screen (not in Git).

### Vercel

1. **Add New → Project**, import the Git repository.
2. Framework preset **Vite**; build command `npm run build`; output directory `dist` (`vercel.json` already says so).
3. Add the two environment variables for **Production** (and Preview if you use it).
4. Deploy, then **Settings → Domains** and add your domain. Vercel serves HTTPS automatically.

### Netlify

1. **Add new site → Import an existing project**, pick the repository.
2. Build command `npm run build`, publish directory `dist` (`netlify.toml` already says so).
3. **Site configuration → Environment variables**: add the two variables.
4. Deploy, then **Domain management → Add a domain**. HTTPS is automatic.

### Any other host

Serve the contents of `dist/` and make sure: (a) every path that is not a real file returns `index.html` with status 200 (otherwise reloading `/admin/players` shows "not found"); (b) `/sw.js` and `/manifest.webmanifest` are sent with `Cache-Control: no-cache` (otherwise installed copies never learn about an update); (c) `/assets/*` may be cached for a year (the file names change on every build); (d) the security headers below are sent.

### The security headers (already in `vercel.json` and `netlify.toml`)

| Header                    | Value                                                                                                                                                                                                                                                                                                  | Effect                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` | The page may load code only from itself and talk only to Supabase; it cannot be put in a frame |
| `X-Content-Type-Options`  | `nosniff`                                                                                                                                                                                                                                                                                              |                                                                                                |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                      |                                                                                                |
| `X-Frame-Options`         | `DENY`                                                                                                                                                                                                                                                                                                 | Older browsers' version of `frame-ancestors`                                                   |
| `Permissions-Policy`      | `camera=(), microphone=(), geolocation=()`                                                                                                                                                                                                                                                             | The app uses none of these                                                                     |

To tighten `connect-src`, replace `*.supabase.co` with your exact host (`<project-ref>.supabase.co`). The policy is verified by the end-to-end tests (`e2e/csp.spec.ts`): they run the built app under it and fail on any violation. If you add a service that needs another origin (analytics, a map), add it to the policy in **three** places: `vite.config.ts`, `vercel.json`, `netlify.toml`.

The site also sends `robots.txt` (`Disallow: /`) and a `noindex` tag: this is a private tool and must not appear in search results.

## 7. After the first deploy — smoke test

Do this on a phone, in both languages (the language button is at the top of every screen):

1. Open the site: the login screen appears; it is right-to-left in Arabic.
2. Sign in as the admin → the home screen shows the four numbers, today's sessions and the activity feed with a green **Live** badge. Open **More → Locations** and add the academy's locations first: sessions and subscriptions cannot be created without one.
3. **Coaches → Add coach**: create a coach; then sign in as that coach in a private window (they see no Reports, Expenses, Coaches, Discounts or Settings).
4. As the coach: **Add player**, then **New subscription** for them (pay in full), then schedule a session for today and **Take attendance**.
5. Back as the admin: the four actions appear at the top of the activity feed within a couple of seconds; **Reports** shows the payment; **Expenses → Generate salaries** works.
6. **Registration form:** open `<your site>/register` in a private window (no sign-in): fill in a parent and a child, send it, and check that the request appears under **More → Registrations** with a badge on **More**; accept it (the child becomes a player) and try the **Message on WhatsApp** button. The link parents use is the site's address followed by `/register` — **More → Registrations → Copy registration link** copies it. Delete nothing: test requests stay (Q-010) — reject them.
7. **Install:** in Chrome on Android a card "Install the app" appears on the home screen (or use the browser menu → _Install app_); on iPhone: Share → _Add to Home Screen_. The app opens full-screen with the Ajyal icon.
8. Turn on airplane mode and reopen the app: it opens and shows "You're offline".

If any step fails, see §10.

## 8. Updating the app

**Code change:** merge to the main branch → the host rebuilds and deploys. Installed copies notice the new version within an hour (or on the next launch) and show **"A new version of the app is ready — Update"**; nothing reloads by itself, so nobody loses a half-filled form.

**Database change:** add a new file to `supabase/migrations/` (never edit one that has been applied), test it, then `npx supabase db push`. Deploy the website **after** the migration when the new app needs the new database, and the website **before** the migration when the migration removes something the old app still uses (expand → deploy → contract). Migrations are applied in file-name order; keep the timestamp prefix.

**A project whose migrations were applied through the dashboard or an MCP tool** (the Ajyal development project was) records them under the _time they were applied_, not the file-name timestamps, so `npx supabase db push` would think none of the files has run and try to apply them again. On such a project either keep applying new migrations the same way, or first reconcile the history once: `npx supabase migration list` shows the two columns; for each pair `npx supabase migration repair --status applied <file-timestamp>` after `--status reverted <recorded-timestamp>`. On a project you created for production and filled with `db push` (§2) this never comes up.

**Edge Function change:** `npx supabase functions deploy create-coach`.

**Rolling back the website:** promote the previous deployment in Vercel / Netlify (one click). The database has no automatic rollback: write a new migration that undoes the change.

## 9. Backups and recovery

Money and attendance history live only in the database, so back it up.

- **Supabase plans:** Pro keeps **daily backups** for 7 days (**Database → Backups**), and **Point-in-Time Recovery** can be added. The Free plan does not include automatic backups — do not run the academy on it.
- **Your own copy** (recommended monthly, and before any risky change), from a machine with `pg_dump` (connection string under **Project Settings → Database**):

  ```bash
  pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
    --schema=public --no-owner --format=custom --file=ajyal-$(date +%F).dump
  ```

  Keep the file somewhere other than the Supabase account (an encrypted drive, or the academy's cloud storage). It contains personal data of children and their guardians: treat it as confidential.

- **Restore** into a _new_ project: apply the migrations (§2), then `pg_restore --data-only --schema=public --disable-triggers -d "<new connection string>" ajyal-….dump`. Then create the auth users again (auth is not in this dump), and set each profile's `id` to the new user's id — or restore the `auth` schema too with Supabase's support.
- **Test a restore once** before you need it.
- **Reports export** (Reports → Export) gives every payment and expense of a month or year as a spreadsheet: a readable second copy of the money.
- Deleted players and cancelled subscriptions are only _marked_ deleted/cancelled, and expenses' deletions are logged, so most mistakes can be undone from the data itself.

## 10. Troubleshooting

| Symptom                                                         | Likely cause and fix                                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The app opens but every screen says it can't load data          | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing or wrong **at build time** — fix in the host's variables and redeploy (changing them without a rebuild does nothing) |
| Sign-in says "Incorrect email or password" for a right password | The user was created without **Auto Confirm**, or the email has a typo; check **Authentication → Users**                                                                    |
| Sign-in works, then the app returns to the login screen         | The account has **no profile** or the profile is **inactive** (§5)                                                                                                          |
| "This account is inactive"                                      | The profile's `active` is false: set it on the Coaches page or with SQL                                                                                                     |
| Reloading `/admin/players` shows the host's "404"               | The single-page-app rewrite is missing (§6, "Any other host" (a))                                                                                                           |
| Browser console: "Refused to connect … Content Security Policy" | The site talks to an origin the policy does not list: your Supabase project host differs from `*.supabase.co` (custom domain) — add it to `connect-src`                     |
| Adding a coach fails with a generic error                       | Check **Edge Functions → create-coach → Logs**; the function must be deployed (§4); the email may already exist                                                             |
| The feed shows no "Live" badge                                  | Realtime is disabled on the project, or a corporate network blocks WebSockets. The feed still refreshes every minute                                                        |
| An update never reaches installed phones                        | `/sw.js` is being cached — send `Cache-Control: no-cache` for it (§6)                                                                                                       |
| "Install app" never appears                                     | The site is not on HTTPS, or the manifest/icons are not being served (open `/manifest.webmanifest` and each icon URL)                                                       |
| A page says "This page couldn't be loaded"                      | The app was updated while the page was open: tap **Reload**                                                                                                                 |
| Payments/attendance saved on a phone are missing                | The phone was offline: nothing is queued offline — it says "You're offline" and changes are **not** saved; repeat when connected                                            |

## 11. Costs and limits (rough)

Supabase Pro plus a free static-hosting tier is enough for an academy of hundreds of players. Watch **Database size** and **Auth users** on the Supabase usage page; the data is small (text and numbers only, no files).

## 12. Security checklist before go-live

- [ ] Sign-ups are **off** (§3); leaked-password protection is **on** (Pro).
- [ ] `supabase/seed.sql` was **not** run; there are no accounts with published passwords.
- [ ] Only the publishable key is in the host's variables; the service-role key is nowhere in the repository or the host.
- [ ] Supabase **Advisors** (Security) shows only the intentional notes: "Public can execute SECURITY DEFINER function" for `public_locations` and `submit_player_applications` (the parents' form), "Signed-in users can execute SECURITY DEFINER function" for the app's own functions (each checks who is calling — see `docs/04-data-model.md`) and, on the Free plan, the leaked-password note.
- [ ] The registration link (`/register`) works in a private window and the request reaches **More → Registrations**; the two `anon`-executable functions in the Advisors list are the only ones.
- [ ] At least one **location** exists (More → Locations); on a database migrated from an earlier version, the places typed on old sessions became locations — switch off any that were test entries, and give older subscriptions and expenses a location if the reports should split them.
- [ ] Every admin account uses a strong, unique password; a departed coach is deactivated.
- [ ] A backup exists and a restore was tried (§9).
