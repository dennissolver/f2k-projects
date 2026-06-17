# FTK — Visitor Analytics + Ad Monetization: Build Spec (rescoped)

A brief for Claude Code. Implements ad monetization on the F2K estate pages, with visitor
analytics supplied by a third-party cookieless tool rather than hand-built. Both halves are
built as independent, `site`-keyed, toggleable modules **inside `f2k-projects`** (not a
separate service yet — see "Strategic framing"). Neither may degrade the estate page's
primary job: getting the visitor to select a lot and submit the enquiry form.

---

## Strategic framing (read first — it shapes scope)

- **Primary goal:** monetize the qualified, agent-driven traffic on each estate page so ad
  revenue helps cover the operational cost of the page and of F2K — i.e. revenue that is
  *not* tied to selling a specific lot. Estate pages get strong, high-intent traffic because
  the managing agents drive their own client base to them.
- **The sell is qualified-intent adjacency, not impressions.** The audience is people
  actively buying a block of land in a specific region. An ad for a local builder, mortgage
  broker, conveyancer, building inspector, or solar/landscaping company beside that form is
  worth a flat ~$1,100/month/slot **because of relevance and exclusivity, not volume.**
  Pricing is flat monthly sponsorship; tracking exists to **prove value at renewal**, not to
  bill per impression.
- **Category exclusivity is a first-class concept**, not a later add-on: at most one active
  advertiser per category per estate ("the only mortgage broker on the Seafields page").
- **GTM (dogfood → productize):** F2K is "client #1". Build the module **in this repo**,
  `site`-keyed and self-contained, trial it on real estate pages, and only extract it to a
  standalone shared service once a second operator is actually signed. **Do not** stand up a
  separate multi-tenant service / separate deployment now — keeping the `site` key clean is
  the seam that makes later extraction cheap. Standing up tenancy/billing/auth for a second
  customer that doesn't exist yet is out of scope.

---

## Phase 1 build plan — eng-review locked (2026-06-16)

`/plan-eng-review` split the spec by buildability and buyer-readiness:

- **Phase 1 (build now): visitor analytics only.** Small (~6-8 files), zero changes to the
  estate-page/form layout, and it starts the data you need to (a) compare estates as the
  operator and (b) sell ad slots later.
- **Phase 2 (deferred until advertiser #1 signs): the ad system** (serving, tracking, voice,
  advertiser CRUD, per-ad dashboard). See "NOT in Phase 1" below.

**Phase 1 locked decisions (these override any conflicting detail in Feature 1 below):**

1. **One Umami bucket, filter by path.** Single website-id (`0bf4d75b-1289-4626-b9f6-aae0e734c6e4`).
   Per-estate numbers come from filtering the Umami API by URL path, NOT a website-id per
   estate. Cross-estate comparison reads from the one bucket. (Supersedes the
   `UMAMI_SITE_<slug>_ID` per-estate scheme — there is one `UMAMI_WEBSITE_ID`.)
2. **Submissions counted from the existing per-estate registration tables**
   (`seafields_registrations`, `branscombe_registrations`, …), NOT a new client event and NOT
   `audit_log`. No new tables in Phase 1.
3. **Per-estate config lives in `src/data/estates.ts`** (extend the existing registry with
   `registrationsTable`, `analyticsPath`/reuse `path`, `trackAnalytics`). One source of truth;
   no second config file.
4. **Conversion = submissions ÷ unique visitors (headline) AND ÷ sessions (secondary).**
   Pageviews is the wrong denominator (scroll-heavy pages inflate it). Show both; uniques is
   the headline. `pageviews/uniques == 0` → render `—`. An estate with **no registration
   funnel** → render **N/A**, never a misleading `0%`.
5. **Umami API responses cached** via Next `unstable_cache`, ~10 min TTL keyed by
   `(estate, window)`. **Cache the DB submission counts the same way** — don't hit Postgres on
   every dashboard load.
6. **Tracking script mounts in `(public)/layout.tsx`, NOT the shared root layout, and is
   suppressed in demo mode** (`NEXT_PUBLIC_DEMO_MODE`). The root layout also wraps `/admin`,
   `/agent`, and the `f2k-projects-demo` deploy — sending those into the one production bucket
   pollutes the numbers sold to advertisers. Public estate pages only.
7. **Analytics-start-date floor.** Umami starts at zero on ship day; the DB has months of prior
   submissions. Any window spanning that cutover divides history by ~0 pageviews → garbage.
   Clamp conversion windows to an `ANALYTICS_START_DATE` and label pre-floor periods "no
   traffic data".
8. **Spike the Umami Cloud API FIRST** (before building the adapter): confirm `api.umami.is`
   auth, the path-filtered breakdown shape, free-tier rate limits, and history retention — and
   that they match the self-host API (the "self-host later behind the same seam" promise depends
   on it).
9. **Dashboard at `/admin/analytics`** behind the existing admin auth (`middleware.ts` +
   `getAdminUser` + `admin_users` allowlist). Built now (not deferred) because estate-vs-estate
   comparison is an operator need today, independent of advertisers.

**What already exists and is reused (not rebuilt):** the estate registry (`src/data/estates.ts`),
the registration tables + their submit pattern (`src/app/api/seafields/register/route.ts`), the
admin auth chrome (`src/middleware.ts`, `src/lib/admin-auth.ts`, `admin_users`), and the RLS
discipline from migration 0027 (service-role writes, anon never reads — Phase 1 adds no
anon-written tables, so this only matters in Phase 2).

**NOT in Phase 1** (deferred, each with a reason):
- The entire **ad system** — serving, `advertiser`/`ad_creative`/`ad_event` tables, impression/
  click/voice tracking, voice via `@caistech/elevenlabs-convai` + monthly cap, category
  exclusivity, sponsored labelling, advertiser CRUD, per-ad dashboard. *Reason: no advertiser
  signed yet; needs real traffic numbers to sell.*
- The **public on-page stats box** (live/curated). *Reason: nothing to display publicly until
  there's traffic worth showing; private operator dashboard comes first.*
- **Self-hosted Umami.** *Reason: Cloud now for zero ops; migrate behind the same `lib/analytics`
  adapter seam when a second domain appears or the cloud tier caps out.*
- A **new `form_submit` client event.** *Reason: redundant — existing registration rows already
  are the conversion numerator.*

---

## Step 0 — Understand the existing codebase first (do this before writing anything)

This repo is **Next.js (App Router) + TypeScript + Supabase (Postgres, RLS) on Vercel**.
Confirm by inspection, then:

1. Locate the estate page template(s), the "click a lot → scroll to form" interaction, and
   the lot-enquiry form component. These are the integration points. Match existing
   conventions (Tailwind, existing component patterns) — introduce no new framework or
   styling approach.
2. Identify the existing Supabase migration workflow (`scripts/supabase-push-migration.ps1`,
   project ref `earqebbwhklxadqawtex`; demo `cjlcywifsrwcecajammi`) and the existing
   **admin auth** (Supabase auth **plus** the `public.admin_users` allowlist gate). Reuse
   both — do not add a new persistence layer or a shared-token gate.
3. Confirm whether `@caistech/elevenlabs-convai` is already consumed in the repo (the
   developer-onboarding "Morgan" agent uses it). The ad voice agents reuse this package.
4. Report back the detected stack and your proposed file/route/migration changes before
   implementing. Then implement Feature 1 wiring (analytics tool + event seam), then
   Feature 2 (ad system + dashboard).

Everything below is **behavioural spec**. Adapt naming and structure to the codebase.

---

## Feature 1 — Visitor analytics (buy, don't build)

### Decision: Umami (cookieless), not a hand-built tracker and not GA — Cloud now, self-host later
Hand-rolling a tracker means also owning bot filtering, unique-visitor dedupe, retention,
trend queries, and a dashboard — all commodity. **Use Umami.** Not Google Analytics: GA4 is
cookie-based by default (consent-banner overhead we want to avoid), sends data to Google, and
its API/data model are painful to pull into our own advertiser-facing dashboard.

**Phasing (deliberate):**
- **Phase 1 — Umami Cloud now**, to start collecting immediately with zero ops. Tracking
  script (already provisioned for the first estate page):
  ```html
  <script defer src="https://cloud.umami.is/script.js"
    data-website-id="0bf4d75b-1289-4626-b9f6-aae0e734c6e4"></script>
  ```
  The website-id and script src are **public** (they ship in page source) — committing them is
  fine. The Umami **API key is secret** → Vercel env, `sensitive`. The server adapter reads
  the API at `https://api.umami.is`.
- **Phase 2 — self-host before the dashboard goes advertiser-facing**, for data ownership (the
  numbers are the product we sell advertisers) and to avoid per-site cloud fees as the module
  rolls onto more F2K sites. Trigger to flip: a second `site`, or approaching the cloud tier's
  event cap. Self-host = Docker `ghcr.io/umami-software/umami` (source:
  https://github.com/umami-software/umami) + its **own Postgres, separate from the
  f2k-projects Supabase** (do not point Umami at `earqebbwhklxadqawtex`).

**The swap is cheap by design:** everything goes through the single `lib/analytics` adapter, so
moving Cloud → self-host is only a change of API base URL + key + website-id env vars — no page
or dashboard rewrite.

**Env vars** (`sensitive`, production+preview only): `UMAMI_API_URL` (default
`https://api.umami.is`, later your self-host URL), `UMAMI_API_KEY`, `UMAMI_SITE_<slug>_ID`
(e.g. `UMAMI_SITE_SEAFIELDS_ID=0bf4d75b-1289-4626-b9f6-aae0e734c6e4`). The tracking script
loads on the estate pages; the server adapter calls the API with the key — never expose the key
client-side.

### What this feature delivers
- **Install the chosen analytics tool** (recommend self-hosted Umami) and add its lightweight
  script to the estate pages (and other tracked F2K pages), keyed so traffic is attributable
  **per `site` and per `path`/`page_type`** (`estate`, `lot`, `other`). Cookieless;
  bot-filtered by the tool; no consent banner required for AU.
- **A server-side read adapter** (`lib/analytics/`) that calls the tool's API and returns,
  for a given `site`/`page` and time window:
  - Total visits (all-time / this month / today) and unique visitors for the same windows.
  - Breakdown by referrer source (`direct`, `email`, `search`, `social`, `referral`) — most
    F2K traffic is agent email, so UTM/email detection matters. Tag agent outreach links with
    UTM params so this attributes cleanly.
  - Breakdown by device type.
  - 30-day trend (dashboard only).
  This adapter is the single seam; if we ever swap the provider, only this file changes.

### Custom events we DO still own
The analytics tool covers sitewide traffic. Two things it won't do well and we record
ourselves (see Feature 2's `ad_event`, and the conversion watch):
- **Per-advertiser ad performance** (impression / click / voice session) — Feature 2.
- **`form_submit`** on the lot-enquiry form — so we can watch form-completion rate before/
  after ads go live and confirm we aren't cannibalising the core conversion.

### On-page stats box (optional, OFF by default)
- A small, unobtrusive bottom-of-page component showing totals (overall / this month / today),
  reading from the analytics adapter.
- Config-driven: `statsBox.show` (per site) and `statsBox.mode` = `live` | `curated` |
  `hidden`. `curated` displays config values (e.g. floored numbers) rather than the raw live
  count — a safety valve so a low early live count doesn't undercut the ad sell.
- **Invariant: `curated` numbers are public-box only. The advertiser dashboard always shows
  real numbers.** Showing curated figures to advertisers who buy on them is a
  misleading-conduct risk — never do it.
- No source/device breakdown on the public box; that lives in the private dashboard.
- Do not oversell "unique visitors" — label it an estimate in any advertiser-facing surface.

---

## Feature 2 — Ad system on estate pages

### Goal
Sell the space flanking the lot-enquiry form to a small number of **directly-sold**,
**category-exclusive** sponsors. Each ad shows a logo, headline, an opt-in "talk to their AI
agent" button (ElevenLabs), and a link to the advertiser's site. Track impressions/clicks/
voice-sessions per advertiser to prove value at renewal. **No programmatic/CPM ad server** —
a config + DB-backed rotation is correct for flat-fee direct sales.

### Data model
- **advertiser**: `id`, `name`, `active`, `category` (e.g. `builder`, `mortgage_broker`,
  `conveyancer`, `inspector`, `solar`, `landscaping`, …), `contact`, `monthly_fee`, notes.
- **ad_creative**: `id`, `advertiser_id`, `site`, `slot` (`form-left` | `form-right` |
  `form-mobile`), `logo_url`, `headline`, `cta_text` (default: "Click here to hear about
  {name}"), `voice_agent_id` (ElevenLabs agent-id, nullable), `voice_monthly_cap` (max voice
  sessions/month for this advertiser — see cost cap), `destination_url`, `weight` (int),
  `active`, `start_date`, `end_date`.
- **ad_event**: `id`, `ad_creative_id`, `type` (`impression` | `click` |
  `voice_session_start`), `timestamp`, `session_id` (coarse, server-generated; no cookie),
  `device_type`. No raw IP, no persistent visitor identifier.

### Category exclusivity (enforced)
At most one **active** creative per (`site`, `category`) at a time, and at most one active
creative per (`site`, `slot`). Enforce in the serving query and validate on create/update in
admin (reject a second active advertiser in a category already taken for that site).

### Slots & layout (mobile matters)
- **Desktop (≥ lg):** `form-left` and `form-right` rails flank the form. Reserve fixed
  dimensions to avoid layout shift (target CLS ~0); content loads async into the reserved box.
- **Mobile/tablet:** side rails are **hidden** (no room beside a form on a phone; most
  estate-page traffic is agent emails opened on mobile). Render one `form-mobile` slot
  **directly below the form**. Fully responsive; degrades to this automatically.
- Ads live in their own containers, load asynchronously, and must never block or interfere
  with the form's JS or submission, nor capture its taps.
- **Every ad is clearly labelled "Sponsored" / "Advertisement"** (ACL/ACCC requirement on a
  property page — non-negotiable).

### Rotation & serving
- For each slot: select the active, in-date creative honouring slot + category exclusivity
  (weight only breaks ties if multiple are eligible — normally one). Single advertiser per
  slot per render.
- Server-side / hydration-time selection so an impression can be logged reliably.
- **Fail silent:** no eligible creative → render nothing; on desktop the form occupies the
  space gracefully.

### Tracking (for renewal proof, not billing)
- **Impression:** logged when the creative is actually in the viewport (IntersectionObserver),
  not merely loaded — so reported impressions are real.
- **Click:** logged on the destination-link click; link opens in a new tab
  (`target="_blank" rel="noopener noreferrer"`).
- **Voice session:** logged on opt-in (below).
- All event writes are **fire-and-forget to a server endpoint** — never block render, never
  write directly from the client to the DB (see RLS below).
- Surface impressions / clicks / CTR / voice-sessions per advertiser in the private dashboard.

### ElevenLabs voice agent (opt-in only) — via `@caistech/elevenlabs-convai`
Each advertiser can have their own ElevenLabs Conversational AI agent (knowledge base set up
at onboarding). **Consume the portfolio voice stack `@caistech/elevenlabs-convai` and its
`/react` `VoiceWidget`, mounting the advertiser's `voice_agent_id`. Do NOT hand-inject the raw
CDN `<elevenlabs-convai>` script** — the raw embed is banned portfolio-wide; the shared widget
already handles lazy mount, the conversation-duration cap, webhook HMAC verification, and
degrade-don't-fake.

- Render a button with `cta_text`. **Nothing audio-related loads or plays until the user
  clicks** (mandatory: autoplay is blocked, visitors are often at work/in public, and we must
  not interrupt form completion).
- On click: lazy-mount the shared `VoiceWidget` for that advertiser's `voice_agent_id` and log
  a `voice_session_start`. Clear close/dismiss control. Only one voice widget active at a time.
- **Cost containment (no advertiser BYOK — the flat fee covers usage, so a cap protects it):**
  the $1,100/month fee is fixed; ElevenLabs bills per conversation, so a runaway/abused agent
  could exceed the fee. Enforce a **hard monthly per-advertiser voice-session cap**
  (`voice_monthly_cap`): on reaching it, the voice button degrades to a normal link/disabled
  state for the rest of the period (hard-cut, not soft-warn). The shared widget's
  conversation-duration cap stays on as a second guard. Size the cap so worst-case monthly
  voice cost stays comfortably under the fee.
- **Operational note (flag to the user, not a code task):** each site domain must be added to
  the agent's **Allowlist** in the ElevenLabs dashboard or the widget won't load.

### Protect the core conversion
- The form remains the priority — ads must not shift, delay, or capture taps from it.
- `ads.enabled` is a **per-site kill switch**: if the `form_submit` rate dips after ads go
  live, pull them in one toggle. Watch form-completion rate before/after via the `form_submit`
  event.

---

## Private advertiser dashboard
- **Reuse the existing admin auth** (Supabase auth + `public.admin_users` allowlist). No
  shared-token gate.
- Per `site`/`page`: traffic totals, uniques (labelled estimate), 30-day trend, source +
  device breakdowns (from the analytics adapter), **joined with** per-advertiser
  impressions / clicks / CTR / voice-sessions (from `ad_event`).
- Designed to be screenshot/share-friendly — this is the artefact shown to advertisers at
  renewal. **Real numbers only (never curated).**

---

## Security & RLS (this repo had a prior anon-exposure P0 — do not repeat)
- All event writes (`ad_event`, `form_submit`) go through a **server endpoint / route
  handler**; the anon client never writes directly to, and **never reads**, the event tables.
- Migration must set explicit RLS: no `FOR ALL TO public USING(true)` policies. Anon gets, at
  most, a scoped insert-only path via the server; dashboard reads are admin-only. Mirror the
  RLS discipline established in migration `0027`.
- No raw IPs retained anywhere (the analytics tool handles geo/uniques; we store none).

---

## Cross-cutting requirements
- **Config-first & reusable:** everything keyed by `site` so the module drops onto other F2K
  sites later. Feature flags: `analytics.enabled`, `statsBox.show`/`statsBox.mode`,
  `ads.enabled` (per site).
- **In-repo module boundary:** keep ads + analytics-adapter code self-contained (e.g.
  `lib/ads/`, `lib/analytics/`, `components/ads/`) so later extraction to a shared service is
  a clean lift. No separate deployment/service now.
- **Performance:** all tracking fire-and-forget; ad + voice assets lazy-load; reserve ad
  dimensions to keep CLS ~0.
- **Privacy:** cookieless; no raw IPs; coarse geo only; consistent with AU privacy
  expectations.
- **Admin:** minimal CRUD for advertisers/creatives (reuse existing admin patterns; enforce
  category + slot exclusivity on save). A seed/config file is acceptable for phase 1 if no
  admin UI yet, but the exclusivity validation must still apply.

## Acceptance criteria
1. Estate-page visits are recorded by the analytics tool, attributed per `site`/`page`,
   cookieless, no consent banner; the form still renders and submits normally.
2. The analytics adapter returns totals, uniques, source + device breakdowns, and 30-day
   trend for a given site/page.
3. Stats box: hidden by default; `live` shows correct totals; `curated` shows config values;
   curated never appears in the advertiser dashboard.
4. Desktop shows category-exclusive left/right ads flanking the form; mobile hides them and
   shows one ad below the form; no layout shift; every ad is labelled "Sponsored".
5. Impressions log on real viewport visibility; clicks log and open the advertiser site in a
   new tab; event writes go through the server, never anon-direct, and anon cannot read events.
6. Voice button loads nothing until clicked; on click it mounts the correct advertiser's
   agent via `@caistech/elevenlabs-convai` `VoiceWidget` and logs a voice session; the monthly
   per-advertiser voice cap hard-cuts when reached.
7. Private dashboard (behind existing admin auth) shows real traffic + per-advertiser
   performance, screenshot-friendly.
8. `form_submit` is tracked and visible so ad impact on conversion can be monitored; `ads.
   enabled` per-site toggles ads off cleanly.

## Out of scope (phase 2)
- Extraction to a standalone multi-tenant service, self-serve advertiser signup/billing,
  programmatic/CPM serving, A/B creative testing. Leave clean seams (the `site` key + the
  `lib/analytics` adapter are the seams).

---

### Start by reporting the detected stack and your proposed file/route/migration changes
### (including the Umami Cloud wiring + env vars, with the self-host seam noted), then implement.

---

## Implementation Tasks (Phase 1 — analytics)
Synthesized from the eng review. P1 blocks ship; P2 should land same branch.

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — analytics — Spike the Umami Cloud API
  - Surfaced by: outside voice #4 — Cloud API shape/limits assumed, not verified
  - Verify: a throwaway script hits `api.umami.is` and returns path-filtered uniques+sessions; note rate limits, retention, self-host parity
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** — layout — Mount Umami script in `(public)/layout.tsx`, `defer`, suppressed under `NEXT_PUBLIC_DEMO_MODE`
  - Surfaced by: outside voice #3 — root layout pollutes /admin, /agent, demo into the bucket
  - Verify: script present on `/seafields-estate` view-source; absent on `/admin` and the demo deploy
- [ ] **T3 (P1, human: ~30min / CC: ~5min)** — config — Extend `src/data/estates.ts` (`registrationsTable`, `analyticsPath`, `trackAnalytics`)
  - Verify: `npx tsc --noEmit`; adapter reads the registry
- [ ] **T4 (P1, human: ~4h / CC: ~30min)** — analytics — Build `lib/analytics/adapter.ts` (getTraffic / getSubmissions / getConversion[uniques headline + sessions] / getComparison) with `unstable_cache` 10min on Umami **and** DB counts, `ANALYTICS_START_DATE` floor, divide-by-zero → `—`, no-funnel → `N/A`, Umami-down → degrade
  - Surfaced by: arch #1/#2, perf cache, outside voice #1/#5/#6
  - Verify: unit tests (T5) green
- [ ] **T5 (P1, human: ~2h / CC: ~15min)** — tests — Adapter unit tests (mapping, divide-by-zero, no-table→N/A, Umami-down degrade)
  - Verify: test run green
- [ ] **T6 (P1, human: ~4h / CC: ~30min)** — dashboard — `/admin/analytics` per-estate side-by-side (pageviews/uniques/sessions/source/device + conversion), behind existing admin auth
  - Verify: admin sees it; non-admin redirected (T7)
- [ ] **T7 (P2, human: ~1h / CC: ~10min)** — tests — E2E: admin sees dashboard; non-admin → `/admin/login`
- [ ] **T8 (P2, human: ~30min / CC: ~10min)** — verify — Assert the tracking script actually fires (pageview sent, cookieless, `defer`)
  - Surfaced by: outside voice #8 — silent no-data is the one untested risk
- [ ] **T9 (P2, human: ~1h / CC: ~15min)** — navbar — Surface `/admin/analytics` in the admin nav (ties into the State→Location→Estate nav rationalisation)

**Env vars (Vercel, sensitive where noted, prod+preview):** `UMAMI_API_URL` (`https://api.umami.is`), `UMAMI_API_KEY` (sensitive), `UMAMI_WEBSITE_ID` (`0bf4d75b-…`), `ANALYTICS_START_DATE`, `NEXT_PUBLIC_DEMO_MODE` (reuse if present).

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 4 issues resolved, 0 critical gaps; scope reduced to Phase 1 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

- **OUTSIDE VOICE:** Codex unavailable on Windows (`Unsupported platform: win32`); fell back to an independent Claude reviewer — 8 findings. 2 raised as cross-model tensions (denominator unit, build-now-vs-defer); both decided by the user. 5 folded into the plan (script placement, cache DB counts, start-date floor, API spike, script-fires test). 1 (N/A vs 0%) folded into the denominator decision.
- **VERDICT:** ENG CLEARED — Phase 1 ready to implement. CEO + Design review optional (Design recommended once the dashboard UI is built).

NO UNRESOLVED DECISIONS
