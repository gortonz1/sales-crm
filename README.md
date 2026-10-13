# Kargul Starter

Next.js 16 + React 19 + Tailwind CSS 4 boilerplate. Read `CONVENTIONS.md` before writing any component, section, or page — it is the whole spec for how this repo is built.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Sales CRM setup

The CRM runs on the Supabase project **CRM** (`vzmfwfzdwakyzgdfnezf`).

- `cp .env.example .env.local` for the Supabase URL and publishable key.
- `/login` — sign in, or create an account the first time. Only `@themarketingtrainer.co.uk` addresses can create an account (a trigger on `auth.users` rejects anything else, and the form checks before submitting). Only addresses in `public.crm_members` (with a confirmed email) can then see leads; add one with `insert into public.crm_members (email) values ('name@themarketingtrainer.co.uk');`.
- `/leads` — website enquiries from themarketingtrainer.co.uk, as a list or a board by stage. **Add lead** records an enquiry that arrived by email instead of the form; it is stored with `source = 'email'`, gets a "received" activity on the date the email came in, and otherwise behaves like any other lead. A lead added by hand can be deleted from its detail sheet; website enquiries can't, because the next sync would only add them back.
- `/ai-course` — the AI in Marketing Level 4 enquiries and mock exam opt-ins, each with a built-in **Interest** column (Potential / Solid). The dashboard tile counts that column directly.
- `/boards/:id` — custom boards. An admin creates one from **New board** in the sidebar, either blank or imported from monday.com (groups, columns, status labels with their colours and uploaded files come across; the copy isn't linked back to monday, so it's edited like any other board). Anyone can add groups and items and edit cells. Columns are admin-only, on this and every other board: an admin uses each column header's menu (rename, type, labels, move, hide, delete), the `+` at the far right of the table, or **Columns** in the toolbar (also **Board → Edit columns**), which lists every column in one place. Everyone else sees the columns as they are, and the `board_columns` policies enforce it in the database. Deleted boards, groups, columns and items sit in `/bin` for 30 days, where anyone can restore groups and items and admins can restore boards and columns.
- **Automations** (toolbar on any custom board, also **Board → Automations**) — monday-style rules, admin-created, that run when something on the board changes. A rule is a trigger plus an action. Triggers: _a file is added to a Files column_, _a status changes_ (to a particular label, or any), _an item is created_. Actions: _extract with AI into columns_ (file trigger only), _set a cell_ (a label, a value, today plus or minus some days for a date, or clear it; text values can copy other cells with `{{Column name}}`), _send an email_, _send a text message_. Drop a CV into "CV" and the AI reads it and fills, say, First name, Second name, Email, Location and Phone on that row; the cells show "Extracting…" while it runs and fill in live for everyone on the board. Set Status to "Interview" and the candidate gets the email or text you wrote, with `{{Column name}}`, `{{Item}}` and `{{Board}}` filled from the row; the recipient is an Email or Phone column on the item or a fixed address or number. A rule that sets a cell can set off other rules; the chain stops after five hops so two rules can't ping-pong forever. Anyone can **Run on existing items** to backfill an AI rule over rows that already have files, see each rule's runs, and **Retry** a failed one. PDFs, images and plain text go straight to the model; Word files are converted to text first. Server settings on Railway: `ANTHROPIC_API_KEY` for AI (`ANTHROPIC_MODEL` overrides the model, default `claude-opus-5-5`); `RESEND_API_KEY` and `RESEND_FROM` (for example `The Marketing Trainer <crm@themarketingtrainer.co.uk>`, on a domain verified in Resend; optional `RESEND_REPLY_TO`) for email; `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` (a Twilio number or approved alphanumeric sender ID; or `TWILIO_MESSAGING_SERVICE_SID`) for texts. UK numbers written as `07…` are sent as `+447…`. The dialog says which of these are missing. Runs are queued by a database trigger into `automation_jobs` and processed by the app, kicked off by the browser that made the change or opened the board. To also process jobs without anyone on the board, set `AUTOMATION_WEBHOOK_SECRET` and `SUPABASE_SECRET_KEY` on Railway and add a Supabase Database Webhook on `automation_jobs` inserts that POSTs to `/api/automations/run` with an `x-automation-key` header carrying the secret.
- **Column widths** — an admin drags the border on the right of a column header to widen or narrow it (double-click resets it to the default for its type; arrow keys work when the handle is focused). The width saves to `board_columns.width` for everyone. The **Item** column on a custom board resizes the same way and saves to `boards.item_width`.
- **Recruitment role column** — a column type on custom boards that links an item (say, a candidate) to a row on the Recruitment board. The cell is a searchable picker of the clients on `/recruitment`, with their contact and status underneath, and an **Open** link that lands on that client's detail (`/recruitment?item=<id>`). Filter and sort by it like a status column. The cell stores the recruitment's id, so renaming the client updates every linked item.
- `/earnings` — reads the Apps Indicative Earnings Report CSV and models planned starts, early finishes and EPAs. It sits behind its own password on top of CRM membership: the database checks it (`earnings_unlock`), allows 5 wrong tries per 15 minutes, and an unlock lasts 12 hours. **Save** stores the parsed figures and the what-ifs in `private.earnings_workspace` (one shared workspace, never the raw CSV), readable only through the unlocked session. Change the password with `insert into private.earnings_password (id, hash) values (true, extensions.crypt('new password', extensions.gen_salt('bf', 10))) on conflict (id) do update set hash = excluded.hash;` — only the hash is stored.
- **Costs** (bottom of `/earnings`, behind the same password) — the last 12 months of costs by expense category, read-only from Sage Accounting. Needs `SAGE_CLIENT_ID` and `SAGE_CLIENT_SECRET` on Railway, from the app at developer.sage.com, whose callback URL must be this site's `/api/sage/callback` (set `SAGE_REDIRECT_URI` to pin it). **Connect Sage** signs in at Sage; the tokens are encrypted with a key derived from the client secret and stored in `private.sage_connection`, readable only through an unlocked earnings session. Sage drops the login after about a month unused, and the section then offers **Reconnect Sage**. Once connected, the earnings dashboard also shows a **Forecast profit and loss** for the funding year: income from the forecast less costs, using Sage's actual costs for closed months and, for the rest, every recurring category (costs in at least 3 of the last 4 complete months) at its average over the last 3. **Recurring costs** lets you treat any category as recurring, one-off or a fixed monthly amount; those choices save with the plan.
- `supabase/migrations/` — the schema (leads, stages, activity log, access rules, `ingest_website_lead`).
- `supabase/functions/website-lead/` — the endpoint the website posts each new enquiry to, authorised by an `x-crm-key` header whose SHA-256 is in `public.ingest_keys`. The website only ever adds leads: if an enquiry's `external_id` is already in the CRM the row is left exactly as it is, so edits made here are never overwritten by a re-sync or backfill. The website side lives in `the-marketing-trainer` (`src/lib/crm.ts`, `scripts/sync-crm.ts`).

| Script                 | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Start the dev server                                               |
| `npm run build`        | Production build                                                   |
| `npm run start`        | Serve the production build                                         |
| `npm run lint`         | ESLint                                                             |
| `npm run to:avif`      | Convert an image to AVIF and report its inline cost — rule 11      |
| `npm run extract:avif` | Pull the first frame of every `.webm` under `public/` as a poster  |
| `npm run frame:rive`   | Render a still from a `.riv` file for use as its poster            |

## First things to set on a new project

1. **`lib/seo.ts`** — `SITE_NAME`, `SITE_URL`, `SITE_DESCRIPTION`, `SITE_ROUTES`. Everything in `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/route.ts` and every page's metadata derives from these (rule 18). Set `NEXT_PUBLIC_SITE_URL` in the environment to override the URL per deploy.
2. **`app/globals.css`** — match the `@layer base` type scale and the `--padding-section-*` tokens to the design before building anything (rules 1 and 3).
3. **`app/opengraph-image.jpg`** — 1200×630, with an `opengraph-image.alt.txt` beside it.
4. **Fonts** — `app/layout.tsx` ships Inter + a local Inter Display; swap them for the design's typeface.

## Docs

| File               | What's in it                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `CONVENTIONS.md`   | The build rules. Read first.                                        |
| `AGENTS.md`        | Next.js version notes for agents                                    |
| `OPTIMIZATION.md`  | Why `Asset`'s Rive loading is gated behind LCP, with the measurements |
