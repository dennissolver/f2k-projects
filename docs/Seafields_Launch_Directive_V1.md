# Seafields Launch — Claude Code Build Directive V1

**Project:** f2k-projects.vercel.app/seafields-estate
**Stack:** Next.js (Vercel) + Supabase + existing admin panel
**Authored by:** Dennis McMahon, 15 May 2026
**Strategy sign-off:** Uwe Jacobs (verbal, 15 May 2026)

---

## 0. Read this section first

This directive describes a multi-pass build. **Do not start coding before Section 1 (Audit) is complete and findings have been reported back.** Several decisions below depend on what's already wired up in Supabase; if you change the schema without auditing first, you'll break the admin panel.

The strategy is settled. The implementation needs care.

**Operating principles for this build:**

1. **Audit before writing.** Map the existing Supabase schema, the admin panel surface, and the current registration flow before proposing any changes.
2. **Schema is additive, not destructive.** New tables and columns are fine. Renaming or dropping existing columns requires explicit sign-off from Dennis.
3. **Every state change goes through the audit log.** No silent updates to lot status, allocation, or pricing — ever.
4. **Reserved lots are first-class citizens.** They display, they collect backup interest, they notify when released. They are not a dead-end.
5. **Public-facing copy comes from the admin panel, not from code.** Hardcoded labels like "Reserved — GROH allocation" must be admin-editable per lot.
6. **Test the FOMO mechanics with seed data before going live.** The waitlist → heating up → notification chain has to be exercised end-to-end on staging, not in production.

---

## 1. Audit Phase (do this first, report back before proceeding)

Before writing any code, produce a short audit report covering:

### 1.1 Supabase schema audit

List every table and column currently in the Supabase database. For each table relevant to this build, identify:

- Primary key, foreign keys
- Row count
- Whether it's actively read/written by the live site or the admin panel
- Any triggers, RLS policies, or stored procedures

Focus areas: anything related to lots, stages, registrations, users, allocations, audit/logs.

### 1.2 Admin panel surface audit

What can Uwe and Tanveer currently do in the admin panel? For each lot-related operation, document:

- The page/route
- The fields they can edit
- The validation rules
- Whether changes go through any logging or approval flow

### 1.3 Registration flow audit

When a public visitor clicks "Add to my registration" on a lot, trace the full flow:

- What fields are captured
- Where the data lands (Supabase table)
- Whether anyone is notified (email, admin alert)
- What the registrant sees afterwards

### 1.4 Report back

Produce a markdown file at `/docs/audit-report.md` summarising the above. **Stop and wait for Dennis to review before moving to Section 2.**

---

## 2. Strategic Model (read carefully — this is what we're building toward)

The launch implements a **staged price-escalation strategy** where FOMO is driven by the visible price ladder, not manufactured scarcity:

1. **Stage 1 only is open for registration at launch.** Stages 2–7 are visible on the site (lots, sizes, AND prices), but their registration buttons are locked.

2. **Each stage has a higher $/m² rate** than the one before. Punters can see exactly what the same-size lot costs in Stage 2 vs Stage 1.

3. **When Stage 1 hits an auto-advance threshold** (e.g. 80% of public lots Reserved or Sold), Stage 2 unlocks automatically and prior Stage 1 registrants receive a notification email.

4. **The FOMO chain on individual Available lots** runs: Waitlist (1st registrant) → Heating Up (2nd registrant, both parties notified) → Multiple Interested (3rd+, all parties notified, agent urged to lock down).

5. **GROH (14 lots), Baurimus (5 lots), Takken (10 lots) sit as Reserved.** They are not in the public pool. Reserved lots are visible on the site with their allocation context, and accept backup-list registrations.

6. **Pricing model:** Land $ = Area (m²) × Stage Rate ($/m²). H&L packages add a House $ component. Per-lot pricing overrides exist for institutional allocations.

This strategy was confirmed by Uwe on 15 May 2026 ("You captured it well").

---

## 3. Data Model (canonical schema)

The workbook `Seafields_Lot_Allocation_Master_V1.xlsx` (in the project files) is the canonical conceptual model. Implement the following Supabase tables. If equivalent tables exist, propose a migration path rather than duplicating.

### 3.1 `stages`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| stage_number | int unique | 1 through 7 |
| stage_label | text | e.g. "SW Block — Launch" |
| rate_per_sqm | numeric | Land $/m² for this stage |
| escalation_pct | numeric | Computed: vs Stage 1 (% above) |
| is_open_for_registration | boolean | Drives whether the "Add to registration" button is active |
| auto_advance_threshold_pct | numeric | Default 80. When (Reserved+Sold) / TotalPublicLots ≥ this, next stage auto-opens |
| public_visible | boolean | If false, stage and its lots are hidden from the public site |
| created_at, updated_at | timestamptz | |

### 3.2 `lots`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lot_number | int unique | From CLE plan |
| area_sqm | numeric | From V6 register |
| category | text | Compact / Standard / Large / Premium |
| zone | text | e.g. "Pepper Gate West / SW Block" |
| stage_id | uuid FK → stages | |
| status | text enum | 'available', 'reserved', 'withheld', 'sold', 'backup_list_only' |
| allocated_to | text enum | 'public', 'groh', 'baurimus', 'takken', 'wachs', 'f2k_withheld', 'display_home', 'heritage_retained' |
| dwelling_type_id | uuid FK → dwelling_types | Nullable (null = land only) |
| land_only | boolean | |
| land_rate_override_per_sqm | numeric | Nullable. If set, overrides stage rate for this lot |
| house_cost | numeric | Nullable, used when land_only = false |
| display_price_to_public | boolean | If false, price is hidden (e.g. institutional allocations) |
| public_label | text | Free text override for the lot card, e.g. "Reserved — GROH allocation" |
| internal_notes | text | Admin-only |
| created_at, updated_at | timestamptz | |

**Computed values (do these as Postgres views or generated columns):**
- `effective_rate_per_sqm` = `land_rate_override_per_sqm` if set, else lookup from `stages.rate_per_sqm`
- `land_total` = `area_sqm × effective_rate_per_sqm`
- `total_price` = `land_total + COALESCE(house_cost, 0)`

### 3.3 `dwelling_types`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text unique | e.g. "GROH-3B" |
| plan_name | text | |
| bedrooms | int | |
| bathrooms | int | |
| floor_area_sqm | numeric | |
| build_cost_default | numeric | Used as default if lot.house_cost is null |
| notes | text | |

### 3.4 `registrations`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lot_id | uuid FK → lots | |
| email | text | |
| name | text | |
| phone | text | |
| referrer | text | Agent code or 'direct' |
| registration_type | text enum | 'primary' (Available lot), 'backup_list' (Reserved lot) |
| stage_at_registration_id | uuid FK → stages | Locks the stage they registered under for price-protection purposes |
| status | text enum | 'active', 'locked_in', 'converted_to_sale', 'cancelled', 'released' |
| position_in_queue | int | 1, 2, 3+ — computed at insert time |
| created_at, updated_at | timestamptz | |

### 3.5 `audit_log`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| timestamp | timestamptz | |
| actor | text | User who made the change (admin user email, or 'system' for auto-advance) |
| entity_type | text | 'lot', 'stage', 'registration', 'pricing' |
| entity_id | uuid | |
| field_changed | text | e.g. 'status', 'stage_id', 'rate_per_sqm' |
| old_value | jsonb | |
| new_value | jsonb | |
| reason | text | Free text, required for manual changes |

**Every mutation to `lots`, `stages`, or `registrations` must produce an audit_log row.** Implement this as a Postgres trigger so it cannot be bypassed by application code.

### 3.6 RLS policies

- Public (anon) role: SELECT only on `lots` (filtered to `stages.public_visible = true`), `stages` (filtered to `public_visible = true`), `dwelling_types`. INSERT only on `registrations` with rate limiting.
- Admin role (Uwe, Tanveer): full CRUD on all tables.
- Audit log is INSERT-only for everyone (no UPDATE or DELETE).

---

## 4. Build Phase 1 — Foundation (after audit sign-off)

In this order. Do not start a sub-task until the previous one is verified.

### 4.1 Schema migration

Author Supabase migrations to bring the database to the schema in Section 3. If existing tables overlap, write a non-destructive migration plan and surface it for review before running on production.

### 4.2 Seed the data from the workbook

Import the lot data from `Seafields_Lot_Allocation_Master_V1.xlsx` into the new schema. The workbook is the source of truth for:
- Stage labels and rates (from `Stage_Pricing_Ladder` sheet)
- Lot register (from `Lot_Allocation_Master` sheet)
- Dwelling types catalogue (from `Dwelling_Types` sheet)

For any fields Uwe has not yet filled in (most allocation, dwelling, and price-override fields), import as NULL. The admin panel must handle NULLs gracefully.

### 4.3 Admin panel updates

Extend the existing admin panel to support the new fields:

- **Lots screen:** allocation, dwelling type dropdown, land-only toggle, rate override, house cost, display-price toggle, public label, internal notes.
- **Stages screen:** rate per m², auto-advance threshold, is_open_for_registration toggle, public_visible toggle.
- **Dwelling types screen:** CRUD for the catalogue.
- **Registrations screen:** view all registrations per lot, change registration status, send manual notification to registrant.
- **Audit log screen:** read-only, filterable by entity, date, actor.

Every admin action must require a "Reason" field if it changes status, allocation, or pricing. This populates `audit_log.reason`.

---

## 5. Build Phase 2 — Public-facing behaviour

### 5.1 Stage visibility and locking

- Stages 1–7 all visible on the public map.
- Each stage shows its rate (and therefore each lot shows its computed price unless `display_price_to_public = false`).
- Only stages with `is_open_for_registration = true` show an active "Add to registration" button.
- Locked stages show: *"Opens after Stage [previous] is allocated. Register now in Stage [previous] to lock in current pricing."*

### 5.2 Lot detail panel

The lot detail panel renders differently by status:

**Available:**
- Lot # / Size / Category / Zone / Stage / Price
- "Add to my registration" button (active)
- Heat signal (see 5.3)

**Reserved:**
- Lot # / Size / Category / Zone / Stage
- `public_label` text (e.g. "Reserved — GROH allocation")
- Price hidden if `display_price_to_public = false`, shown otherwise
- "Register as backup — we'll notify you if this lot becomes available" button (active)

**Withheld:**
- Lot # / Size / Category / Zone / Stage
- "Not currently available"
- No registration option

**Sold:**
- Lot # / Size / Category / Zone / Stage
- "Sold" status
- No registration option

### 5.3 Heat signals on Available lots

On the public map and lot detail panel:

- **0 registrations:** Default tile colour.
- **1 registration:** Tile colour shifts to "interest" (e.g. soft yellow). Detail panel shows: *"1 other party has registered interest in this lot."*
- **2 registrations:** Tile shifts to "heating up" (e.g. amber). Detail panel: *"2 other parties have registered. Contact us or your agent to lock this lot in."*
- **3+ registrations:** Tile shifts to "hot" (e.g. orange/red). Detail panel: *"Strong interest — multiple parties registered. Contact us urgently to discuss locking this lot in."*

These colour states must be implemented as design tokens in the existing design system, not hardcoded.

### 5.4 Notification emails

When a registration lands on an Available lot:

1. The new registrant receives a confirmation email.
2. **All prior registrants on the same lot** receive a notification: *"Another party has just registered interest in Lot [X]. To discuss locking this lot in before others, contact us or your agent."*

When a registration lands on a Reserved lot (backup list):

1. The registrant receives a confirmation: *"Thanks for your interest. This lot is currently reserved for [allocation context]. We'll notify you immediately if it becomes available."*

When a Reserved lot is released (status changes to Available):

1. All backup-list registrants on that lot receive a notification: *"Lot [X] has just become available. Contact us within 24 hours if you'd like to register your primary interest."*

When a stage auto-advances:

1. All Stage [previous] registrants whose interest hasn't converted receive: *"Stage [previous] is now fully allocated. Stage [next] is now open at [new rate]. Your registered price is no longer guaranteed — contact us to discuss locking in."*

Use a transactional email provider (Resend, Postmark, or SendGrid — pick whatever's already wired up; if none, recommend Resend). Email templates must be admin-editable, not hardcoded in source.

### 5.5 Stage auto-advancement

Implement as a Postgres function triggered after every `lots` UPDATE:

```
ON UPDATE of lots.status:
  FOR the stage containing this lot:
    pct_allocated = (count of lots WHERE status IN ('reserved', 'sold') AND allocated_to != 'public')
                  / (total public lots in this stage)
    IF pct_allocated >= stage.auto_advance_threshold_pct:
      SET next stage's is_open_for_registration = true
      AND optionally SET this stage's is_open_for_registration = false (admin-configurable)
      AND log to audit_log with actor = 'system', reason = 'auto-advance threshold reached'
      AND trigger notification email batch to prior registrants of this stage
```

**Important:** the auto-advance threshold counts allocations *out of the public pool*. Reserved institutional lots (GROH/Baurimus/Takken) do not count toward triggering advancement — they're already off-market. Only public-pool conversions (waitlist → locked, or public → sold) tip the threshold.

The threshold is configurable per stage (default 80%) so Uwe can tune. There must also be a manual "Force advance to next stage" button in the admin panel that bypasses the auto rule, with a mandatory reason logged.

---

## 6. Build Phase 3 — Operational tooling

### 6.1 Internal dashboard for Uwe / Dennis / Tanveer

A separate authenticated page showing:

- Real-time lot map with every lot's status, allocation, and registration count
- Per-stage progress bar (% allocated, distance to auto-advance)
- Registration feed (chronological list of all new registrations across all lots)
- Backup-list queue per Reserved lot
- Recent audit log entries
- "Pending notifications" queue (anything that hasn't sent yet)

### 6.2 CSV exports

Admin panel needs CSV exports of:
- All lots with current status
- All registrations
- Audit log (filtered by date range)

These export under the same column structure as the workbook, so they can be re-imported back into the master spreadsheet for reconciliation.

### 6.3 Bulk import

Admin panel needs a "Bulk import lot updates from CSV" function. Same column structure as the workbook. Each row imported writes an audit_log entry. This is how Uwe's completed workbook gets pulled into the live system in one pass.

---

## 7. Out of scope for this directive (Phase 4+)

The following are explicitly **not** part of this build and should not be attempted without a follow-up directive:

- Online payment for holding deposits (the "lock-in" mechanism — currently handled off-platform via agents)
- SMS notifications (email only for now)
- Integration with REIWA or Realestate.com.au listings
- Agency portal with separate logins (agents register via the public form using the Referrer field)
- BTR sub-project (Keystart institutional sleeve)
- Branscombe Road site (separate project)

If any of these surface as "wouldn't it be easy to also…" while building — they're not. Flag them and stop. Dennis will decide whether to expand scope.

---

## 8. Definition of Done for this directive

This build is complete when:

1. The audit report (Section 1) is produced and approved by Dennis.
2. The Supabase schema (Section 3) is migrated, seeded with workbook data, and verified — all RLS policies in place, all triggers firing.
3. The admin panel (Section 4.3) supports every field in the new schema and gates every status/allocation/pricing change behind a required-reason audit log entry.
4. The public site (Section 5) renders Available / Reserved / Withheld / Sold lot states correctly, locks/unlocks stages based on `is_open_for_registration`, and shows heat signals at 1 / 2 / 3+ registrations.
5. All notification email flows (Section 5.4) are wired up, with admin-editable templates, and have been exercised end-to-end on staging.
6. Stage auto-advancement (Section 5.5) fires correctly on the staging instance against seed data — confirmed by a documented test sequence.
7. The internal dashboard (Section 6.1) and CSV exports/imports (Section 6.2, 6.3) work.
8. A handover document at `/docs/launch-runbook.md` exists, describing for Tanveer:
   - How to release a Reserved lot
   - How to manually advance a stage
   - How to amend pricing mid-launch
   - How to read the audit log
   - How to export the day's registrations to CSV
   - What to do if the auto-advance fires unexpectedly

---

## 9. Reporting cadence

After Section 1 (audit), report back and wait for sign-off before proceeding.

After each subsequent Phase (4, 5, 6), produce a short progress note in `/docs/build-log.md` covering:
- What was built
- What was tested
- Any deviations from this directive and why
- Any blockers or open questions for Dennis

Do not make a deployment to production without an explicit instruction from Dennis. Staging deployments are fine and encouraged.

---

## 10. References

- Live site: https://f2k-projects.vercel.app/seafields-estate
- Lot allocation master workbook: `Seafields_Lot_Allocation_Master_V1.xlsx` (project files)
- CLE plan revision 08B: source of canonical lot numbers and areas
- Cooperation Agreement (19 March 2026): governs lot allocation authority — relevant for the Takken question
- Working memory: F2K is secured lender, development controller, and active development manager. Uwe Jacobs (Property Friends) is MD. Tanveer is admin operator.

---

**End of directive.**

When you've read this through, your first action is Section 1.1 — the Supabase schema audit. Do not proceed past Section 1 without explicit sign-off from Dennis.
