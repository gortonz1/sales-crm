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
- `/leads` — website enquiries from themarketingtrainer.co.uk, as a list or a board by stage.
- `/ai-course` — the AI in Marketing Level 4 enquiries and mock exam opt-ins, each with a built-in **Interest** column (Potential / Solid). The dashboard tile counts that column directly.
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
