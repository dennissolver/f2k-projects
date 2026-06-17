# Umami self-host deploy — Option A (Umami on Vercel + f2k Supabase `umami` schema)

> **Decision (2026-06-17):** run a self-hosted Umami instead of paying for Umami Cloud Pro (the
> REST API at `api.umami.is` is a paid Cloud feature). We're **f2k-focused on analytics for now**,
> so Umami's tables live in a dedicated **`umami` schema inside the existing f2k Supabase Pro
> project** (`earqebbwhklxadqawtex`) — no new project, $0 extra. Umami itself runs as its own
> Vercel project (it's a Next.js app). This file is the runbook + the env contract the f2k
> analytics adapter (`src/lib/analytics/umami.ts`) expects.

---

## What you end up with

```
┌───────────────────────────┐        tracking script         ┌──────────────────────────┐
│ f2k-projects (this app)   │  ── pageview beacons ─────────▶ │ Umami app (own Vercel proj)│
│ public pages emit beacons │                                 │ Next.js, reads/writes ▼    │
│ /admin/analytics reads ───┼── @umami/api-client (userId/────┤ f2k Supabase `umami` schema │
│ via umami.ts (self-host)  │   secret auth) ◀───────────────  │ (earqebbwhklxadqawtex)     │
└───────────────────────────┘                                 └──────────────────────────┘
```

- One Umami **website** (bucket) for the whole f2k site; per-estate numbers come from filtering by
  URL path (each estate's `href`). That logic already lives in `umami.ts` / `adapter.ts`.
- Umami connects to Postgres over a **direct connection string** (the `postgres` role) — it does
  **not** use the Supabase anon/service keys, so Supabase RLS doesn't gate it (expected; Umami
  manages its own access). Keeping its tables in an **unexposed `umami` schema** keeps them
  invisible to the anon key, satisfying the portfolio RLS-on-everything rule.

---

## Step 1 — Prepare the `umami` schema in f2k Supabase

Create the isolated schema **before** the first Umami build so its ~10 tables never land in
`public` next to `seafields_registrations` etc.

```sql
-- Run in the f2k Supabase SQL editor (project earqebbwhklxadqawtex)
create schema if not exists umami;
-- Prisma (Umami's ORM) creates/owns its tables here when it migrates.
```

**Do NOT add `umami` to Settings → API → Exposed schemas.** Only `public` / `graphql_public` are
exposed by default, so a new `umami` schema is automatically off the PostgREST/anon surface. Leave
it that way.

Grab two connection strings from **Settings → Database → Connection string** (copy them verbatim —
don't hand-build the host/region):

| Use | Which string | Port | Append |
|---|---|---|---|
| **Migrations** (Umami build) | **Direct** (`db.<ref>.supabase.co`) | 5432 | `?schema=umami` |
| **Runtime** (serverless reads) | **Transaction pooler** (`...pooler.supabase.com`) | 6543 | `?schema=umami&pgbouncer=true` |

> **Pooler/direct nuance** (the standard Supabase + Prisma dance — see
> `supabase-cli-link-drift-footgun` memory for the family of footguns): migrations need the
> **direct** connection; serverless runtime should use the **pooler** to avoid exhausting
> connections. f2k traffic is low (low thousands of pageviews/month), so if you want to keep it
> simple you *can* use the direct connection for both — but the pooler is the correct serverless
> default. Easiest path: set `DATABASE_URL` to the **direct** string for the very first deploy (so
> the build's migration runs), confirm tables exist in the `umami` schema, then switch
> `DATABASE_URL` to the **pooler** string and redeploy.

---

## Step 2 — Deploy the Umami app to Vercel

1. Fork (or clone-and-push) `https://github.com/umami-software/umami` into the `caistech` org.
2. Vercel → **New Project** → import that repo. Framework auto-detects as Next.js.
3. Set environment variables (Production + Preview, secrets marked **sensitive** per the portfolio
   Vercel rule):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | the **direct** string from Step 1 (switch to pooler after first build) |
   | `APP_SECRET` | any long random string — **save it**, it's reused as the API-client `secret` |

   *(Node ≥ 18.18 — Vercel's default is fine. Umami's `build` runs the Prisma migration that
   creates the tables + a default admin account.)*
4. Deploy. Note the app URL, e.g. `https://f2k-umami.vercel.app`.
5. Confirm the `umami` schema in Supabase now contains tables (`website`, `session`,
   `website_event`, …). If they landed in `public`, the `?schema=umami` param was missing — fix the
   URL and redeploy.
6. **Switch `DATABASE_URL` to the pooler string** (Step 1) and redeploy for the steady-state runtime.

---

## Step 3 — First login + capture the three values f2k needs

1. Open the Umami app URL → log in with the default `admin` / `umami`.
2. **Change the admin password immediately** (Settings → Profile).
3. **Settings → Websites → Add website** — name it `Factory2Key`, domain `factory2key.com.au`.
   Open it and copy its **Website ID** (a UUID).
4. **Settings → Users** → open the `admin` user → copy its **User ID** (a UUID).

You now have the three secrets the f2k adapter needs:

| f2k env var | Source |
|---|---|
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | the Website ID from 3 |
| `UMAMI_API_CLIENT_USER_ID` | the User ID from 4 |
| `UMAMI_API_CLIENT_SECRET` | the `APP_SECRET` you set in Step 2 |

---

## Step 4 — Tracking script on the f2k site (already wired)

`src/app/(public)/layout.tsx:9-25` already injects the Umami tracking `<script>` (public-only,
demo-suppressed) and it's fully env-driven — **no code change needed**:

```ts
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";
const analyticsEnabled = Boolean(umamiWebsiteId) && !isDemoMode;
```

The `src` **defaults to Cloud**, so for self-host you MUST set `NEXT_PUBLIC_UMAMI_SRC` to your
instance's tracker (`https://<your-umami>.vercel.app/script.js`) — otherwise beacons go to Cloud
(where you have no website) and nothing records. This env var is added in Step 5.

---

## Step 5 — Wire the f2k analytics env (self-host auth)

Set these on the **f2k-projects** Vercel project (Production + Preview; the secret + user-id marked
**sensitive**). `umami.ts` auto-selects self-host mode when the `USER_ID` + `SECRET` pair is present:

```
NEXT_PUBLIC_UMAMI_WEBSITE_ID = <Website ID from Step 3>
NEXT_PUBLIC_UMAMI_SRC        = https://<your-umami>.vercel.app/script.js   # tracker beacon (Step 4)
UMAMI_API_CLIENT_ENDPOINT    = https://<your-umami>.vercel.app/api          # read API (this app)
UMAMI_API_CLIENT_USER_ID     = <User ID from Step 3>
UMAMI_API_CLIENT_SECRET      = <APP_SECRET from Step 2>
ANALYTICS_START_DATE         = 2026-06-16
```

Notes:
- **Two different self-host URLs:** `NEXT_PUBLIC_UMAMI_SRC` ends in `/script.js` (the browser
  beacon), `UMAMI_API_CLIENT_ENDPOINT` ends in `/api` (the server read API). Same host, different
  paths — don't swap them.
- **Endpoint must end in `/api`** (the self-host API base) — *not* `/v1` (that's the Cloud shape).
- No `UMAMI_API_KEY` in self-host mode. (If a stray `UMAMI_API_KEY` is also set, the adapter still
  prefers self-host whenever `USER_ID` + `SECRET` are both present.)
- The adapter degrades-don't-fakes: until these are set, `/admin/analytics` renders a clean
  "traffic unavailable" state rather than crashing.

---

## Step 6 — Verify

1. Visit a few public pages on live f2k (e.g. `/seafields-estate`) → within ~30s the Umami app's
   dashboard shows pageviews for that website.
2. Open `/admin/analytics` on f2k → per-estate traffic populates (no "unavailable" banner).
3. Confirm the demo project shows **no** Umami data (tracking is demo-suppressed) and that the
   `umami` schema is **not** listed under Supabase Exposed schemas.
4. Merge `feat/estate-analytics-phase1` → `main` once verified.

---

## Gotchas (portfolio-specific)

- **Free vs Pro framing:** a *new* Supabase project would also have been free — the reason we reuse
  f2k's is to keep one fewer project to manage while analytics is f2k-only. If analytics later goes
  portfolio-wide, revisit moving Umami to its own (or the cockpit's) instance — blast-radius is the
  deciding factor, not cost.
- **APP_SECRET is load-bearing twice:** it's Umami's session secret **and** the API-client `secret`.
  Rotating it on the Umami side breaks f2k's `UMAMI_API_CLIENT_SECRET` — change both together.
- **Vercel sensitive-env rule:** `UMAMI_API_CLIENT_SECRET` + `UMAMI_API_CLIENT_USER_ID` are
  `sensitive`, prod+preview only. `NEXT_PUBLIC_*` are public/`plain`, still prod+preview only.
- **`schema=umami` everywhere:** if you ever run an ad-hoc Prisma command against this DB, keep the
  `?schema=umami` param or you'll touch `public`.
