# Seafields Launch — Audit Report

**Authored by:** Claude Code (read-only audit, no schema or code changes)
**Date:** 2026-05-15
**Scope:** Sections 1.1, 1.2, 1.3 of `Seafields_Launch_Directive_V1.md`
**Status:** Stop-gate. Hold here until Dennis signs off before proceeding to Phase 4.

This is a read-only audit. The current code base, schema, and registration flow are described as they are today, not as they should be. A gap analysis at the end maps current state → directive Section 3 schema and Section 5 behaviour.

---

## 1.1 Supabase schema audit

### 1.1.1 Where the schema lives

All purchaser-portal schema is authored as a single, idempotent migration:
**`supabase/migrations/0001_purchaser_schema.sql`** (697 lines).

The migration header says "applies once to project ref `earqebbwhklxadqawtex`". Whether that's still the live Supabase project should be confirmed from Vercel env (`NEXT_PUBLIC_SUPABASE_URL`) before any new migration runs.

There is no migration tooling beyond raw SQL — there is no `supabase/config.toml`, no Drizzle/Prisma, and no second migration file. Adding migration 0002 onwards is a free choice we can make without retrofitting infrastructure.

### 1.1.2 Tables, columns, FKs, RLS, triggers

#### `audit_log`
- PK: `id uuid`
- Columns: `actor_id uuid`, `actor_email text`, `action text`, `entity_type text`, `entity_id uuid`, `details jsonb`, `ip_address inet`, `created_at`
- RLS: service_role ALL. No public anon access.
- Indexes: on `(action)` and `(created_at DESC)`
- **No DB triggers — audit rows are written by application code only** (via `auditLog()` in `src/lib/admin-auth.ts`). UPDATE/DELETE are not blocked at the DB layer; today the directive's "every state change goes through audit, enforced by trigger so it cannot be bypassed by application code" rule is **not** met.

#### `seafields_registrations`
- PK: `id uuid`
- Columns: `first_name`, `last_name`, `email`, `phone`, `lots_selected text[]`, `interest_type`, `price_preferences jsonb`, `dwelling_preferences jsonb`, location (`suburb`, `postcode`), buyer profile (`buyer_type`, `buyer_profile`, `current_housing`, `purchase_timeline`, `finance_status`, `how_heard`), referrer (`referrer_type`, `referrer_name`, `referrer_company`, `referrer_contact`), `notes`, `consent`, `source`, `created_at`
- **Data model: ONE row per registrant** holding an **array of lot IDs** (`lots_selected: text[]`), not one row per lot×registrant.
  - This is the single biggest divergence from the directive (see gap analysis).
- RLS: service_role ALL. No public anon SELECT/INSERT — the public register endpoint runs server-side with the service key.
- Indexes: GIN on `lots_selected`, btree on `created_at DESC`
- No triggers.

#### `seafields_lot_allocations`
- PK: `lot_number integer` (NOT a uuid)
- Columns: `sqm`, `allocated_to text` (free-text — values seen include `WACHS`, `GROH`), `dwelling_type text` (free-text — `2x2BR`, `3BR`, `4BR`), `stage text` (free-text 1–7), `x_pct`/`y_pct` numeric (centroid for the admin map), `wholesale_price`, `retail_price` (numeric AUD per lot, not per m²), `intent_locked_to_registration_id uuid` (FK → `seafields_registrations.id`), `intent_locked_at`, `intent_locked_by uuid` (FK → `auth.users.id`), `assigned_by uuid`, `assigned_at`, `notes text`, `created_at`, `updated_at`.
- RLS: public anon SELECT (no filter) + service_role ALL.
  - **Public anon can currently read the whole table including `allocated_to`, `notes`, `wholesale_price`, `retail_price`** — but only the unauthenticated public endpoints `/api/seafields/allocations` and `/api/seafields/lots` project a narrow subset, so PII isn't surfaced in practice. The directive should still treat this row-level visibility as a thing to tighten: prices and offtaker names should not be reachable directly via the anon key.
- Indexes: btree on `allocated_to`, `stage`, `intent_locked_to_registration_id` (partial — only where NOT NULL)
- **Triggers: one** — `trg_seafields_lot_allocations_updated_at` keeps `updated_at` fresh. **Not** an audit trigger.
- Seed data: 145 lots inserted from rows 215–406. Most rows have `allocated_to`/`stage` NULL. The institutional pre-allocations are seeded with `allocated_to = 'WACHS'` or `'GROH'` and `dwelling_type` set to `2x2BR`/`3BR`/`4BR` — but no `stage`, no price, no `area_sqm` override beyond the column already there.

#### `branscombe_registrations`, `branscombe_unit_allocations`
Mirror of seafields but for the TAS estate (37 units). Same patterns: array-of-IDs registrations, per-unit allocations with intent-lock, anon SELECT on allocations, audit only at app layer. Not directly in scope for the Seafields directive, but the migrations sit in the same file and any schema change has to leave them untouched.

#### `hemp_homes_waitlist`
A separate program (Hemp Homes for Eco-Communities). Different model — dedupes on `(email, program_slug)` instead of allowing multi-lot ROI. Not in directive scope.

#### `admin_users`
- PK: `id uuid`. Unique on `auth_user_id` (FK → `auth.users.id`) and `email`.
- Columns: `email`, `role text CHECK IN ('super_admin','fund_manager','compliance','read_only')`, `full_name`.
- Seeded with four super_admins: dennis@factory2key.com.au, uwe@factory2key.com.au, tanveer@propertyfriends.com.au, team@propertyfriends.com.au (Lennie).
- **Trigger on `auth.users` INSERT** (`link_admin_user_trigger` → `link_admin_user_on_auth_create()`) auto-links the FK when a seeded admin accepts their invite. There's also a one-shot reconciliation `UPDATE` that runs as part of the migration. This is what commit `dccce06 feat(admin): race-free admin user linking` wired up.

### 1.1.3 Schema gaps vs Section 3 of the directive

| Directive table | Today | Gap |
|---|---|---|
| `stages` | None — stage is just a `text` column on lots | Need a new table with `stage_number`, `rate_per_sqm`, `escalation_pct`, `is_open_for_registration`, `auto_advance_threshold_pct`, `public_visible`. Today the stage `1`–`7` enum lives in `src/data/seafields/lots.ts` (code) and as a free-text column in DB. |
| `lots` | `seafields_lot_allocations` keyed by `lot_number INTEGER` | Existing table is usable but missing: `category`, `zone`, `dwelling_type_id FK`, `land_only`, `land_rate_override_per_sqm`, `house_cost`, `display_price_to_public`, `public_label`, `status enum` (today derived). `stage` needs to become a FK to the new `stages` table. PK should probably stay `lot_number` to avoid breaking the admin panel — it joins everywhere on lot_number. |
| `dwelling_types` | None — dropdown of `2x2BR`/`3BR`/`4BR` hardcoded in `AdminLotEditModal.tsx`; richer purchaser-facing list in `RegistrationForm.tsx`'s `DWELLING_TYPES`. | New table required. Important: the admin "dwelling_type" and the purchaser "dwelling preference" use two different vocabularies right now (e.g. `2x2BR` admin vs `2x1 ADU / Granny Flat` purchaser-side). The catalogue needs to reconcile both. |
| `registrations` | `seafields_registrations` with `lots_selected text[]` | **Conceptually different.** Today one registrant row references many lots in an array; directive wants one row per (registrant × lot) so it can carry `position_in_queue`, `stage_at_registration_id`, `status enum`, `registration_type ('primary'/'backup_list')`. This is the largest migration. See gap analysis §4 for options. |
| `audit_log` | Exists, but app-level only | Schema is close to what's needed (`actor_email`, `entity_type`, `entity_id`, `details jsonb`). Missing: `field_changed`, `old_value`, `new_value`, `reason` as first-class columns (currently bundled into `details` JSON), and most importantly, **no DB trigger** enforcing audit-on-mutation. Section 3.5 says "implement this as a Postgres trigger so it cannot be bypassed by application code" — we don't meet that today. |
| RLS | Mostly aligned | One concern: public anon can `SELECT *` on `seafields_lot_allocations`, which currently leaks `wholesale_price`/`retail_price`/`notes` via the raw REST endpoint even though the app API doesn't expose them. The directive wants RLS to also drop hidden rows when `stages.public_visible = false`. We'll need a `stages` table to compose that policy. |

### 1.1.4 Row counts

I cannot run `SELECT count(*)` against the live DB from this audit (no MCP/CLI configured in this session). What we know from the seed:
- `seafields_lot_allocations`: 145 rows inserted via `ON CONFLICT DO NOTHING`. Some delta possible if Uwe has edited via the admin panel.
- `seafields_registrations`: live count unknown — visible on the admin dashboard at `/admin` once authenticated.

If you want a live count before approving Phase 4, run from the Supabase SQL editor:

```sql
SELECT
  (SELECT count(*) FROM seafields_lot_allocations) AS lots,
  (SELECT count(*) FROM seafields_registrations)  AS regs,
  (SELECT count(*) FROM audit_log)                AS audit_rows;
```

---

## 1.2 Admin panel surface audit

### 1.2.1 Routes and what they do

The admin panel is in this repo, under `src/app/admin/`. Auth is via Supabase Auth + the `admin_users` table, gated by `src/middleware.ts` (which redirects unauthenticated `/admin/*` traffic to `/admin/login`).

| Route | Purpose | Source |
|---|---|---|
| `/admin` | Dashboard: counts for the three programs (Seafields / Branscombe / Hemp), latest registration timestamps, last 10 audit_log rows, quick links | `src/app/admin/page.tsx` |
| `/admin/login` | Email+password, magic-link, and forgot-password. Already conforms to the global auth-page pattern from CLAUDE.md (Forgot password ✓, no eye-toggle visible from this read — flag below). | `src/app/admin/login/page.tsx` |
| `/admin/reset-password` | Password reset confirmation page | `src/app/admin/reset-password/page.tsx` |
| `/admin/seafields-lots` | Per-lot editor with a clickable map + table. Filters: allocated/available/all, by stage, free-text search. Click any lot to open the edit modal. | `src/app/admin/seafields-lots/page.tsx` |
| `/admin/seafields-pipeline` | Read-only stage pipeline view: status per lot (allocated/soft/interest/available), per-stage totals, prices in AUD. | `src/app/admin/seafields-pipeline/page.tsx` |
| `/admin/branscombe-units`, `/admin/branscombe-pipeline` | Branscombe equivalents | — |
| `/admin/registrations` | Unified registrations list across all three programs. Read-only (no status, no notification, no actions on a row). | `src/app/admin/registrations/page.tsx` |
| `/admin/audit-log` | Read-only last 100 audit_log rows | `src/app/admin/audit-log/page.tsx` |

### 1.2.2 What Uwe & Tanveer can actually edit per lot

From `AdminLotEditModal.tsx` (the modal that opens on any lot click in `/admin/seafields-lots`):

| Field | Type | Validation | Behaviour |
|---|---|---|---|
| `allocated_to` | free-text (no enum) | `max 200 chars` server-side, trim | Setting any value flips public status to `Reserved`. Clearing returns to `Available`. |
| `dwelling_type` | dropdown — hardcoded `["2x2BR", "3BR", "4BR"]` | `max 50 chars` | Free choice. Not validated against any catalogue. |
| `stage` | dropdown — hardcoded `["1"…"7"]` | `max 50 chars` | Free text in DB; the canonical stage of each lot still lives in `src/data/seafields/lots.ts`. |
| `wholesale_price` | numeric AUD | `0 ≤ x ≤ 99,999,999.99` | Per-lot price, no computed pricing model. |
| `retail_price` | numeric AUD | same | Per-lot. |
| `notes` | textarea | `max 1000` | Admin-only. |
| `intent_locked_to_registration_id` | (set via the embedded `AdminLotWaitlist` widget — clicks on a specific registrant row in the lot's interest list) | uuid → registrations | Soft-allocation. Cleared atomically when `allocated_to` is set non-null. |

### 1.2.3 Audit logging on admin actions

- `PATCH /api/admin/seafields/allocations/[lotNumber]` calls `auditLog()` with `action: 'seafields_lot_allocation_updated'` and `entity_type: 'seafields_lot_allocation'`. The diff is bundled in `details`. Old values are **not** captured — only the patch payload.
- GHL forwarding produces `ghl_allocation_forwarded` and `ghl_contact_forwarded` audit rows when a registrant is identifiable.
- **No `reason` is required from the admin** for status / allocation / pricing changes today. The directive requires a mandatory reason field per Section 4.3.
- **No DB trigger** — if an admin (or a future endpoint) updates the lot directly via the service key without calling `auditLog()`, the audit row simply doesn't exist.

### 1.2.4 What's missing vs Section 4.3 of the directive

- Mandatory **Reason** field on any change that touches `status`, `allocation`, or `pricing`.
- **Old-value capture** — currently only the patch payload is logged. Should be `{ field, old, new, reason }` per change.
- **Dwelling types CRUD** UI — today the list is hardcoded in two different places.
- **Stages CRUD** UI — today there is no stages table at all.
- **Bulk import** from CSV (Section 6.3).
- **CSV exports** of lots, registrations, audit log (Section 6.2).
- **Per-registration controls** — change status, send manual notification, mark released, etc.
- **Internal dashboard** with the real-time map, per-stage progress to auto-advance, pending notifications queue (Section 6.1). Today's `/admin` dashboard is a thin counts page.

### 1.2.5 Auth-page pattern check (from global CLAUDE.md)

`/admin/login` should have all three of: Forgot password link, password visibility toggle, working magic-link. From the first 50 lines I read:
- Forgot password: appears to be wired (state has `"reset"` loading variant)
- Magic-link: wired via `supabase.auth.signInWithOtp` equivalent (`handleMagicLink`)
- **Eye-toggle on password input: not yet verified** — I read only the top of the file in this audit. Flag this as a small item to inspect during Phase 4.3 admin polish, not a blocker for Phase 4 build start.

---

## 1.3 Registration flow audit

### 1.3.1 The path a public visitor takes

1. **Landing page** at `/seafields-estate` (`src/app/(public)/seafields-estate/page.tsx`) renders the hero, statistics, staging/tranche copy ("Tranche 1 — 81 of 143 lots", Stages 1–3 + Sutcliffe Rd lots 236–238 — note: the page copy diverges slightly from the directive's "Stage 1 only is open"; current copy treats Stages 1–3 + Sutcliffe as the open tranche).
2. **Map + form** is `RegistrationForm.tsx` (1185 lines). The visitor clicks lot polygons in `SiteMap.tsx`, opens `LotInfoCard.tsx` to see lot details, and clicks **"Add to my registration"** to toggle that lot into `selectedLots`.
3. **Heritage lots are non-selectable** (`toggleLot` returns early when `lot.isHeritage`). Allocated lots show a `"This lot is reserved and is not available for registration"` message — no backup-list capture at all today.
4. Visitor fills the form (multiple sections — buyer profile, interest type, price preferences per lot, dwelling preferences per lot, referrer, consent).
5. Submit → `POST /api/seafields/register`.

### 1.3.2 What the API does

`src/app/api/seafields/register/route.ts`:

1. **Zod validation.** Required: name, email, `lots_selected` (≥1, each matching `/^L\d{1,3}$/`), `consent: true`. Everything else optional.
2. **Single INSERT** into `seafields_registrations` — one row, with the full lot array.
3. **Audit log row** via app-level `INSERT` — `action: 'seafields_roi_submitted'`, `entity_type: 'seafields_registration'`, `entity_id: null` (not the row id — that's a small data-quality miss).
4. **Resend admin email** to `dennis@factory2key.com.au` + `uwe@factory2key.com.au`. Templates are hardcoded HTML in the route handler.
5. **Resend confirmation email** to the registrant. Templates likewise hardcoded.
6. **GHL CRM forward** via `forwardRegistrationToGHL()`. Best-effort, never blocks the response.
7. Returns `{ success: true }`.

### 1.3.3 Heat signals (already partially built)

- `GET /api/seafields/lots` returns `{ counts: { [lotId]: number } }` — a single SQL `SELECT lots_selected FROM seafields_registrations` aggregated in JS. This is the data feeding the public heat colours.
- The legend on the public site (`SiteMap.tsx` lines ~134–137) already shows `Available / 1 interested / 2 interested / 3+ interested / Reserved / Your selection`. So the **visual** part of Section 5.3 is essentially done; what's missing is the design-token wiring (the colours are inline in `STATUS_COLORS`, not in the design system as tokens) and the urgent-tone CTA copy in the lot detail panel at 2 and 3+ levels.
- `GET /api/seafields/allocations` returns the lots whose `allocated_to IS NOT NULL` — drives the "Reserved" tile state. This filter means lots reserved by intent-lock only (soft) are NOT shown as Reserved on the public site today; only hard institutional allocations show as Reserved.

### 1.3.4 What's missing vs Section 5 of the directive

- **No notification to prior registrants** when a new ROI lands on the same lot. The directive's FOMO chain (notify all prior parties on lot when a new one registers) is the highest-leverage missing behaviour — it requires the registrations model to be one-row-per-lot to be implementable cleanly. Today it'd require a JS post-insert loop over `lots_selected` and emails to every overlapping registrant.
- **No stage lock on the public form** — every lot in `LOTS` is selectable (modulo heritage/allocated). Stages 2–7 cannot be "visible but locked" today because the public site has no concept of stage-level "open for registration".
- **No price ladder.** Public site shows "POA" for land pricing in the hero stats, and the lot detail card never shows a price (`LotInfoCard.tsx`'s `dl` block lists Size/Category/Zone/Status — no price row). The directive wants every visible lot to display its computed `area × stage_rate` unless `display_price_to_public = false`.
- **No backup-list mechanism** for Reserved lots. The `"This lot is reserved and is not available for registration"` message in `LotInfoCard.tsx` is a dead-end. The directive wants `"Register as backup — we'll notify you if this lot becomes available"`.
- **No stage auto-advance.** No DB function, no trigger, no admin "force advance" button. Directive Section 5.5 spec needs to be built top-to-bottom.
- **Email templates are hardcoded in `register/route.ts`.** Directive Section 5.4 says "Email templates must be admin-editable, not hardcoded in source." A new `email_templates` table (or equivalent) is implied.

### 1.3.5 Resend / sender domain check (from global CLAUDE.md)

The register route uses `RESEND_FROM_EMAIL` env var, falling back to `Seafields Estate <onboarding@resend.dev>`. The global rule says the only verified sender domain is `updates.corporateaisolutions.com` — so the env var on Vercel **must** be set to something like `Seafields Estate <noreply@updates.corporateaisolutions.com>`. The fallback to `onboarding@resend.dev` will work in dev but should never be hit in production. Worth checking the live Vercel env before launch.

---

## Gap analysis — strategy ↔ wiring

The strategy in Section 2 is settled. The wiring has more done than the directive assumes, and a few places where the conceptual model diverges in ways that need a decision before Phase 4 starts.

### High-leverage decisions that change the migration shape

1. **Registrations model: array-per-row vs row-per-lot.**
   - **Today:** one `seafields_registrations` row holds a `lots_selected text[]`. Heat counts are derived by exploding the array client-side.
   - **Directive Section 3.4:** one row per (registrant × lot), with `position_in_queue`, `status`, `stage_at_registration_id`, `registration_type` etc.
   - **Why this matters:** the FOMO chain (notify prior parties when a new ROI lands on the same lot) and the backup-list semantics (Reserved lot has its own queue) require per-lot rows. A `(registrations array column) + (separate registration_lots join table)` hybrid is possible — keep the existing wide row, add a new child table — but two sources of truth on "who's interested in lot X" will rot.
   - **Recommendation:** introduce a new `seafields_registration_lots` join table as the canonical "interest in this lot" record; keep `seafields_registrations` as the contact / profile record. Migration: explode every existing `lots_selected` array into join rows on Day 1. This is non-destructive to the existing table and the public form keeps working unchanged.
   - **Need from Dennis:** confirm this hybrid model is the right call (vs collapsing `seafields_registrations` to one-row-per-lot and exploding contact info, which would force the form/GHL/Resend flow to change shape too).

2. **Stages: code-as-source vs DB-as-source.**
   - Today the canonical stage of each lot (and stage colour, label) lives in `src/data/seafields/lots.ts`. The DB column is largely NULL.
   - To make `is_open_for_registration`, `rate_per_sqm`, and `auto_advance_threshold_pct` tunable from the admin panel, stages have to become a DB table. The lot-stage relationship needs to swing to a FK that wins over the code constant — or we keep the code constant for visual config (colours, labels) and only the operational fields move to DB.
   - **Recommendation:** create the `stages` table per Section 3.1. Migrate the lot→stage assignments from `lots.ts` into the new table via a one-off seed (the stage 1–7 buckets in code map cleanly). Keep stage colours in code for now — admin UI for colour-tuning isn't in scope per the directive.

3. **Audit log: app-level → trigger-level.**
   - Directive: "Every mutation to `lots`, `stages`, or `registrations` must produce an audit_log row. Implement this as a Postgres trigger so it cannot be bypassed by application code."
   - Today there's no trigger; all audit rows come from the app. If an out-of-band SQL hits production (admin running a hotfix, an automation script), no audit row is created.
   - **Recommendation:** add a generic trigger function that fires AFTER INSERT/UPDATE on `seafields_lot_allocations`, `stages`, and `seafields_registration_lots` (and later `seafields_registrations` if we want profile-edit audit), writing one audit_log row per changed field. The trigger needs an actor context — typically set via `SET LOCAL app.actor_email = '…'` in the admin API before the UPDATE, read by the trigger function. The mandatory `reason` is harder — that has to come in via the same session var.

4. **Pricing model: per-lot prices → area × stage rate.**
   - Today: `wholesale_price` and `retail_price` are stored per lot as numeric AUD. The admin types them in.
   - Directive: pricing is computed from `area × effective_rate_per_sqm` with per-lot `land_rate_override_per_sqm` for institutional allocations. Plus `house_cost` added for H&L packages.
   - **Recommendation:** add the new columns alongside the existing ones; back-fill the old `wholesale_price`/`retail_price` from the new computed values for the first migration so any downstream report doesn't break; switch the admin UI to show computed price + override.

### Things the directive assumes are missing but actually exist

These are bits the directive scopes as new work that are partially or fully wired. Worth noting before Phase 4 starts, so we don't build them twice.

- **Heat signals on the public map (Section 5.3).** Already rendered at 0 / 1 / 2 / 3+ tiers with a legend. Needs CTA-copy polish in `LotInfoCard.tsx` (urgent tone at 2 and 3+) and design-token-isation of `STATUS_COLORS`. Not a from-scratch build.
- **Per-lot click-and-edit admin panel (Section 4.3).** Already exists with a clickable map, an edit modal, allocation + pricing fields, soft intent-lock, and a per-lot waitlist viewer (`AdminLotWaitlist`). What's missing is the **mandatory-reason field**, dwelling-types CRUD, stages CRUD, and the new schema fields.
- **GHL CRM forwarding.** Already wired for new ROIs and for allocation state changes (soft/firm/cleared). Stage-advance notifications will plug into the same path naturally.
- **Race-free admin auto-link.** The auth.users INSERT trigger linking `admin_users` is already there from commit `dccce06`. Adding Tanveer/Lennie is "invite via Supabase Dashboard, trigger does the rest."
- **Tranche/release copy on the public landing page** already mentions Stages 1–3 + Sutcliffe as the open tranche. The directive says Stage 1 only. **Decision needed:** is the strategy actually Stage 1 only, or is the existing Tranche 1 (Stages 1–3 + Sutcliffe Rd) the open set? This contradicts each other and Uwe should reconcile before we lock stage gating into code.

---

## Open questions for Dennis before Phase 4 starts

1. **Confirm the registrations model decision** — hybrid (new `seafields_registration_lots` join table, keep contact row as-is) vs row-per-lot collapse. Hybrid is my recommendation; this controls the migration shape.

2. **Reconcile Stage 1-only vs Tranche 1 = Stages 1–3 + Sutcliffe Rd.** The public landing copy says the latter; Section 2 of the directive says the former. Either Uwe shifted strategy and the copy is current, or the directive supersedes and the copy needs an edit. Confirm before stages become operational.

3. **Mandatory-reason field — who is "mandatory"?** Should the Reason field be required for every change (including a typo in `notes`), or only for changes to `status` / `allocated_to` / `stage` / `wholesale_price` / `retail_price`? Section 4.3 reads as the latter; I'd implement that scope.

4. **Email sender domain confirm.** Is `RESEND_FROM_EMAIL` on the production Vercel env already set to `Seafields Estate <noreply@updates.corporateaisolutions.com>`? If not, that env var change is a precondition for any new notification email going out from the wired flows.

5. **Live Supabase project ref.** The migration header references `earqebbwhklxadqawtex`. Confirm this is still the live project before any 0002 migration runs.

6. **Workbook reconciliation.** `Seafields_Lot_Allocation_Master_V1.xlsx` is in `/docs/`. Section 4.2 says to import from it. The on-DB lot register has 145 rows with most operational fields NULL — Uwe is the source of truth for what fills those fields. Question: is the workbook current and signed off, or is it a partial draft that will change before we seed? If partial, we hold off on the bulk import until it's frozen.

7. **Auth-page eye-toggle.** Quick read of `/admin/login` didn't surface a password visibility toggle. Not a Phase 4 blocker, but flag for inclusion when we touch admin auth pages next.

---

## What I will NOT do without sign-off

Per Section 0 of the directive, I am stopping here. I will not:

- Author migration 0002 or any schema change.
- Modify the public site, the admin panel, the registration API, or the lot data file.
- Run any seed import from the workbook.
- Touch RLS policies, triggers, or email templates.

Once Dennis answers the open questions above, the natural next move is Section 4.1 (schema migration plan, surfaced for review before any SQL runs against production).

**End of audit report.**
