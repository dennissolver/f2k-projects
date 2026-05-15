# Seafields — Migration Plan 0002

**Authored by:** Claude Code
**Date:** 2026-05-15
**Status:** Draft — surface for Dennis review before any SQL runs.
**Scope:** Phase 4.1 of `Seafields_Launch_Directive_V1.md`. Translates the audit findings + locked-in decisions into a concrete migration shape.

This document is the *plan*. No SQL has been executed. Migration file `supabase/migrations/0002_seafields_launch_schema.sql` will be authored only after this plan is approved.

---

## 0. Operating constraints

1. **Non-destructive.** No columns renamed or dropped from the existing schema. Every change is `ADD COLUMN`, `ADD CONSTRAINT`, `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, or `CREATE POLICY`. No `DROP` / `ALTER COLUMN … TYPE` / `RENAME` without explicit Dennis sign-off (per directive Operating Principle 2 and CLAUDE.md "schema is additive, not destructive").
2. **Idempotent.** Migration 0002 must be re-runnable end-to-end without erroring. Use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, etc.
3. **Public surface stays working.** Existing endpoints (`/api/seafields/register`, `/api/seafields/lots`, `/api/seafields/allocations`, admin panel) must keep working unchanged on the moment after the migration runs. Behaviour changes ship in Phases 4.3 and 5, not in this migration.
4. **Targets live project `earqebbwhklxadqawtex`.** No dry-run on a copy — Supabase doesn't have a built-in staging clone here. Run order: local Supabase via `supabase start` (if available), then a staging branch in Supabase, then prod. Sequencing detailed in §11.

---

## 1. New table: `stages`

```sql
CREATE TABLE IF NOT EXISTS stages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number                INTEGER UNIQUE NOT NULL CHECK (stage_number BETWEEN 1 AND 7),
  stage_label                 TEXT NOT NULL,
  rate_per_sqm                NUMERIC(10, 2)
    CHECK (rate_per_sqm IS NULL OR rate_per_sqm >= 0),
  escalation_pct              NUMERIC(5, 2)
    GENERATED ALWAYS AS (
      CASE
        WHEN rate_per_sqm IS NULL THEN NULL
        ELSE NULL  -- computed in app or via view; see note below
      END
    ) STORED,
  is_open_for_registration    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_advance_threshold_pct  NUMERIC(5, 2) NOT NULL DEFAULT 80.00
    CHECK (auto_advance_threshold_pct BETWEEN 0 AND 100),
  public_visible              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Note on `escalation_pct`:** as a true computed column, Postgres would need a reference to the stage 1 rate at query time — generated columns can't `SELECT`. Two options:

- **(a) Drop the column, compute in app/view.** Cleaner. A view `stages_with_escalation` exposes `escalation_pct = (rate_per_sqm / stage_1_rate - 1) * 100`.
- **(b) Keep as a plain numeric column.** Admin types it, no computation. Lowest-tech.

**Recommendation: (a)** — derived data shouldn't be stored. The Phase 4.3 admin UI shows escalation_pct from the view but writes only `rate_per_sqm`.

**Seed:**

```sql
INSERT INTO stages (stage_number, stage_label, is_open_for_registration, public_visible) VALUES
  (1, 'SW Block — Launch', TRUE,  TRUE),
  (2, 'Pepper Gate Central', FALSE, TRUE),
  (3, 'Central', FALSE, TRUE),
  (4, 'Pepper Gate Inner', FALSE, TRUE),
  (5, 'Central Upper', FALSE, TRUE),
  (6, 'Collins Road', FALSE, TRUE),
  (7, 'Final Release', FALSE, TRUE)
ON CONFLICT (stage_number) DO NOTHING;
```

Stage labels are placeholders; Uwe edits via admin UI in Phase 4.3. Stage 1 is the only one open per the locked-in launch strategy.

`rate_per_sqm` stays NULL on seed — Uwe enters from the workbook via the admin Stages screen. Until rates are entered, public price display is suppressed.

**RLS:**

```sql
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_stages"
  ON stages FOR SELECT TO anon, authenticated
  USING (public_visible = TRUE);

CREATE POLICY "service_role_all_stages"
  ON stages FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
```

---

## 2. New table: `dwelling_types`

```sql
CREATE TABLE IF NOT EXISTS dwelling_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  plan_name           TEXT NOT NULL,
  bedrooms            INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
  bathrooms           INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0),
  floor_area_sqm      NUMERIC(6, 2) CHECK (floor_area_sqm IS NULL OR floor_area_sqm > 0),
  build_cost_default  NUMERIC(12, 2) CHECK (build_cost_default IS NULL OR build_cost_default >= 0),
  display_label       TEXT,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dwelling_types_active
  ON dwelling_types (is_active) WHERE is_active = TRUE;
```

**Note on `display_label`:** the audit found the admin uses `2x2BR / 3BR / 4BR` while the public form uses richer text (`"3x2 + Study Modular"`). `code` is the canonical key; `plan_name` is the long-form name; `display_label` is the purchaser-facing string. Reconciles the two vocabularies in one place.

**Seed:** kept deliberately thin — start with the admin's current set, with NULLs for fields Uwe will fill via the catalogue UI:

```sql
INSERT INTO dwelling_types (code, plan_name, bedrooms, bathrooms, display_label) VALUES
  ('2x2BR-ADU',  '2x2 ADU / Granny Flat',  2, 1, '2x1 ADU / Granny Flat'),
  ('3BR-MOD',    '3x2 Modular Home',       3, 2, '3x2 Modular Home'),
  ('3BR-STU-MOD','3x2 + Study Modular',    3, 2, '3x2 + Study Modular'),
  ('4BR-MOD',    '4x2 Modular Home',       4, 2, '4x2 Modular Home'),
  ('4BR-THE-MOD','4x2 + Theatre Modular',  4, 2, '4x2 + Theatre Modular'),
  ('5BR-MOD',    '5x2 Modular Home',       5, 2, '5x2 Modular Home'),
  ('DUAL-OCC',   'Dual Occupancy',         NULL, NULL, 'Dual Occupancy')
ON CONFLICT (code) DO NOTHING;
```

Existing `seafields_lot_allocations.dwelling_type` free-text values (`2x2BR`, `3BR`, `4BR`) stay unchanged — see §3 for the FK reconciliation strategy.

**RLS:** public anon SELECT (active only) + service_role ALL.

```sql
ALTER TABLE dwelling_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_dwelling_types"
  ON dwelling_types FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);
CREATE POLICY "service_role_all_dwelling_types"
  ON dwelling_types FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
```

---

## 3. Additive columns on `seafields_lot_allocations`

```sql
ALTER TABLE seafields_lot_allocations
  ADD COLUMN IF NOT EXISTS stage_id                       UUID REFERENCES stages(id),
  ADD COLUMN IF NOT EXISTS dwelling_type_id               UUID REFERENCES dwelling_types(id),
  ADD COLUMN IF NOT EXISTS status                         TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'withheld', 'sold', 'backup_list_only')),
  ADD COLUMN IF NOT EXISTS allocation_bucket              TEXT
    CHECK (allocation_bucket IS NULL OR allocation_bucket IN (
      'public', 'groh', 'baurimus', 'takken', 'wachs',
      'f2k_withheld', 'display_home', 'heritage_retained'
    )),
  ADD COLUMN IF NOT EXISTS category                       TEXT,
  ADD COLUMN IF NOT EXISTS zone                           TEXT,
  ADD COLUMN IF NOT EXISTS land_only                      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS land_rate_override_per_sqm     NUMERIC(10, 2)
    CHECK (land_rate_override_per_sqm IS NULL OR land_rate_override_per_sqm >= 0),
  ADD COLUMN IF NOT EXISTS house_cost                     NUMERIC(12, 2)
    CHECK (house_cost IS NULL OR house_cost >= 0),
  ADD COLUMN IF NOT EXISTS display_price_to_public        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_label                   TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes                 TEXT;
```

### 3.1 Naming choice — `allocation_bucket` vs renaming `allocated_to`

The directive Section 3.2 names the enum `allocated_to`. The existing schema already has `allocated_to text` storing free-text labels like `'WACHS'`, `'GROH'`. Two options:

| Option | Behaviour |
|---|---|
| **(a) Add `allocation_bucket` (recommended)** | Existing `allocated_to text` keeps holding the free-text counterparty label (e.g. `'WACHS'`, `'Takken Ltd'`). New `allocation_bucket` is the canonical enum (`'wachs'`, `'takken'`, `'public'`, etc). Migration back-fills `allocation_bucket` from existing `allocated_to` values via a `CASE` statement. **Fully additive.** |
| **(b) Rename `allocated_to` → `allocation_partner_name`, add `allocated_to` enum** | Cleaner long-term naming but a destructive rename. Breaks every code reference to `allocated_to` immediately (admin panel, public API, lib code). Requires explicit Dennis sign-off per Operating Principle 2. |

**Recommendation: (a)**. Captures the same information with no breakage. The two columns coexist; the admin UI in 4.3 surfaces both with the enum as the primary picker and the free-text as an optional "counterparty name" field for institutional contracts (e.g. `bucket=takken`, `partner_name='Takken Pty Ltd'`).

Back-fill:

```sql
UPDATE seafields_lot_allocations
SET allocation_bucket = CASE
  WHEN allocated_to = 'WACHS' THEN 'wachs'
  WHEN allocated_to = 'GROH'  THEN 'groh'
  WHEN allocated_to ILIKE '%takken%'  THEN 'takken'
  WHEN allocated_to ILIKE '%baurimus%' THEN 'baurimus'
  WHEN allocated_to IS NULL THEN 'public'
  ELSE NULL  -- review by hand if anything falls through
END
WHERE allocation_bucket IS NULL;
```

Lots that fall through to `NULL` are listed for Uwe / Dennis to classify manually before launch.

### 3.2 Back-fill `stage_id` from existing `stage` text

The existing `stage text` column holds values `'1'` through `'7'` (or NULL). Map them:

```sql
UPDATE seafields_lot_allocations sla
SET stage_id = s.id
FROM stages s
WHERE sla.stage_id IS NULL
  AND sla.stage IS NOT NULL
  AND s.stage_number = NULLIF(sla.stage, '')::INTEGER;
```

Many lots have `stage IS NULL` in the DB but their stage is set in `src/data/seafields/lots.ts`. **Open question (§12.1):** do we also back-fill from the code constants? Answer needed before the migration runs.

### 3.3 Back-fill `dwelling_type_id` from existing `dwelling_type` text

```sql
UPDATE seafields_lot_allocations sla
SET dwelling_type_id = dt.id
FROM dwelling_types dt
WHERE sla.dwelling_type_id IS NULL
  AND sla.dwelling_type IS NOT NULL
  AND dt.code = CASE
    WHEN sla.dwelling_type = '2x2BR' THEN '2x2BR-ADU'
    WHEN sla.dwelling_type = '3BR'   THEN '3BR-MOD'
    WHEN sla.dwelling_type = '4BR'   THEN '4BR-MOD'
    ELSE NULL
  END;
```

### 3.4 Back-fill `status` from existing state

```sql
UPDATE seafields_lot_allocations
SET status = CASE
  WHEN allocated_to IS NOT NULL THEN 'reserved'
  ELSE 'available'
END
WHERE status = 'available';  -- only touches rows still at default
```

Heritage lots (lot 323, lot 379 per `lots.ts`) need `status = 'withheld'` and `allocation_bucket = 'heritage_retained'`. Best to drive this from the code constants on migration (see §12.1).

### 3.5 Back-fill `category` and `zone` from code constants

`src/data/seafields/lots.ts` already has `category` and `zone` per lot. The migration could read them via a script run alongside the SQL (the `scripts/` directory already has a precedent — `migrate-data-from-fund.mjs`). Or we leave both columns NULL and back-fill from the workbook bulk import in Phase 4.2.

**Recommendation:** leave NULL in 0002 migration. Phase 4.2 bulk import is the right place to seed `category`, `zone`, `area_sqm` refinements, dwelling assignments, rates, etc. Less churn, single source of truth (workbook → DB).

### 3.6 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_seafields_allocations_stage_id
  ON seafields_lot_allocations (stage_id) WHERE stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seafields_allocations_status
  ON seafields_lot_allocations (status);

CREATE INDEX IF NOT EXISTS idx_seafields_allocations_bucket
  ON seafields_lot_allocations (allocation_bucket) WHERE allocation_bucket IS NOT NULL;
```

### 3.7 RLS tightening — anon read becomes view-only

**Current behaviour (insecure):** public anon can `SELECT *` from `seafields_lot_allocations` and see `wholesale_price`, `retail_price`, `notes`. Today's API routes don't expose those columns, but the raw anon REST endpoint does. Phase 4.3 will compose stage-visibility + lot-status into a proper public view; the migration prepares it.

**Plan:**

1. Create a public view `seafields_public_lots` that exposes only the columns safe for anon:
   - `lot_number`, `sqm`, `x_pct`, `y_pct`, `status`, `allocation_bucket`, `public_label`, `display_price_to_public`, `category`, `zone`, `stage_id`
   - Plus joined `stages.stage_number`, `stages.stage_label`, `stages.rate_per_sqm` (subject to `display_price_to_public` and `stages.public_visible`)
   - Plus a computed `effective_rate_per_sqm`, `land_total`, `total_price` (NULLed when `display_price_to_public = FALSE`)
2. Grant `SELECT` on the view to anon; revoke direct anon access on `seafields_lot_allocations`.
3. RLS policy on base table changes: anon SELECT is dropped (view replaces it), service_role and authenticated admin keep ALL.

This is a non-destructive change at the schema level (we don't drop a column), but it IS a behaviour change for any consumer reading the raw table via the anon key. **The admin panel uses the service key, so it's unaffected.** The public API routes also use the service key, so they're unaffected.

**Risk:** any external integration (Tableau, retool, a stray script) hitting the anon REST endpoint to read `seafields_lot_allocations` directly stops working. Search for any such consumer before applying.

Suggested view SQL:

```sql
CREATE OR REPLACE VIEW seafields_public_lots AS
SELECT
  sla.lot_number,
  sla.sqm,
  sla.x_pct,
  sla.y_pct,
  sla.status,
  sla.allocation_bucket,
  sla.public_label,
  sla.category,
  sla.zone,
  sla.stage_id,
  s.stage_number,
  s.stage_label,
  s.is_open_for_registration,
  CASE WHEN sla.display_price_to_public AND s.public_visible
       THEN COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
       ELSE NULL END AS effective_rate_per_sqm,
  CASE WHEN sla.display_price_to_public AND s.public_visible
       THEN sla.sqm * COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
       ELSE NULL END AS land_total,
  CASE WHEN sla.display_price_to_public AND s.public_visible
       THEN sla.sqm * COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
          + COALESCE(sla.house_cost, 0)
       ELSE NULL END AS total_price
FROM seafields_lot_allocations sla
LEFT JOIN stages s ON s.id = sla.stage_id
WHERE COALESCE(s.public_visible, TRUE) = TRUE;

GRANT SELECT ON seafields_public_lots TO anon, authenticated;
```

The anon SELECT policy on the base table is then dropped:

```sql
DROP POLICY IF EXISTS "public_read_seafields_allocations" ON seafields_lot_allocations;
```

After this, anon reads must go through the view. **This is the only step in this migration that is technically observable as a behaviour change** — every external consumer needs to be checked first. See §12.2.

---

## 4. New join table: `seafields_registration_lots`

This is the hybrid model from [[seafields-registrations-data-model]] — one row per (registrant × lot) carrying queue and status state, while `seafields_registrations` stays as the contact / profile row.

```sql
CREATE TABLE IF NOT EXISTS seafields_registration_lots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id             UUID NOT NULL
    REFERENCES seafields_registrations(id) ON DELETE CASCADE,
  lot_number                  INTEGER NOT NULL
    REFERENCES seafields_lot_allocations(lot_number) ON DELETE RESTRICT,
  registration_type           TEXT NOT NULL DEFAULT 'primary'
    CHECK (registration_type IN ('primary', 'backup_list')),
  status                      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'locked_in', 'converted_to_sale', 'cancelled', 'released')),
  position_in_queue           INTEGER,
  stage_at_registration_id    UUID REFERENCES stages(id),
  notified_of_neighbour_at    TIMESTAMPTZ,
  notified_of_release_at      TIMESTAMPTZ,
  notified_of_stage_advance_at TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registration_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_srl_lot_status
  ON seafields_registration_lots (lot_number, status)
  WHERE status IN ('active', 'locked_in');

CREATE INDEX IF NOT EXISTS idx_srl_registration
  ON seafields_registration_lots (registration_id);

CREATE INDEX IF NOT EXISTS idx_srl_stage_at_reg
  ON seafields_registration_lots (stage_at_registration_id)
  WHERE stage_at_registration_id IS NOT NULL;
```

**`position_in_queue`:** computed at insert time. The application-level register endpoint counts existing `active` rows for the lot and assigns `position_in_queue = count + 1`. Alternative: implement as a Postgres trigger so it's set automatically — recommend trigger so the application can't bypass it.

```sql
CREATE OR REPLACE FUNCTION set_position_in_queue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position_in_queue IS NULL THEN
    SELECT COALESCE(MAX(position_in_queue), 0) + 1
      INTO NEW.position_in_queue
      FROM seafields_registration_lots
      WHERE lot_number = NEW.lot_number
        AND status IN ('active', 'locked_in');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_srl_set_position
  BEFORE INSERT ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION set_position_in_queue();
```

**Back-fill:** explode every existing `seafields_registrations.lots_selected[]` into join rows. Position assigned by registration `created_at` order per lot.

```sql
INSERT INTO seafields_registration_lots (
  registration_id, lot_number, registration_type, status, position_in_queue, created_at
)
SELECT
  r.id,
  CAST(SUBSTRING(lot_id FROM 2) AS INTEGER) AS lot_number,
  'primary',
  'active',
  ROW_NUMBER() OVER (
    PARTITION BY CAST(SUBSTRING(lot_id FROM 2) AS INTEGER)
    ORDER BY r.created_at
  ),
  r.created_at
FROM seafields_registrations r,
     LATERAL UNNEST(r.lots_selected) AS lot_id
WHERE lot_id ~ '^L\d+$'
  AND CAST(SUBSTRING(lot_id FROM 2) AS INTEGER) IN (
    SELECT lot_number FROM seafields_lot_allocations
  )
ON CONFLICT (registration_id, lot_number) DO NOTHING;
```

After the back-fill, the application keeps writing to `seafields_registrations.lots_selected[]` for now (Phase 4.3 will dual-write to the join table); Phase 5 can switch reads to the join table; eventually the array column becomes deprecated. **The array stays for now** — destructive removal requires explicit sign-off.

`stage_at_registration_id` for back-filled rows is NULL — the historical registrations pre-date stage gating, so there's no canonical answer. New rows set it from the lot's current `stage_id` at insert time.

**RLS:**

```sql
ALTER TABLE seafields_registration_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_srl"
  ON seafields_registration_lots FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
```

No anon access. Heat counts continue to be served via the existing `/api/seafields/lots` aggregation, which the service key reads.

---

## 5. Additive columns on `audit_log`

```sql
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS field_changed TEXT,
  ADD COLUMN IF NOT EXISTS old_value     JSONB,
  ADD COLUMN IF NOT EXISTS new_value     JSONB,
  ADD COLUMN IF NOT EXISTS reason        TEXT;
```

Existing `details jsonb` stays for application-level events (`seafields_roi_submitted`, `ghl_contact_forwarded`, etc.) that don't map to a single field change. Trigger-written rows populate the new columns instead.

**Immutability:** the directive says audit_log is INSERT-only for everyone (no UPDATE or DELETE). Today the service_role policy allows ALL. Tightening:

```sql
DROP POLICY IF EXISTS "service_role_all_audit_log" ON audit_log;
CREATE POLICY "service_role_insert_audit_log"
  ON audit_log FOR INSERT TO service_role
  WITH CHECK (TRUE);
CREATE POLICY "service_role_select_audit_log"
  ON audit_log FOR SELECT TO service_role
  USING (TRUE);
```

No UPDATE or DELETE policy → those operations are denied. **Slight risk:** if the migration itself ever needs to clean up a malformed audit row, it has to be done via `ALTER POLICY` first. Worth confirming before applying. Alternative: keep ALL for service_role and rely on convention.

**Recommendation:** start with the tightened policies. Audit immutability is a directive-level non-negotiable.

---

## 6. Audit trigger — every state change writes a row

Audit at the DB layer (per directive Section 3.5: "so it cannot be bypassed by application code"). Tables in scope:

- `seafields_lot_allocations`
- `stages`
- `seafields_registration_lots`

The trigger reads actor + reason from session variables that the application sets before each UPDATE:

```sql
-- In application code, before any admin UPDATE:
SET LOCAL app.actor_id    = '<admin uuid>';
SET LOCAL app.actor_email = '<admin email>';
SET LOCAL app.audit_reason = '<reason text or NULL>';
```

Generic trigger function:

```sql
CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id    UUID;
  v_actor_email TEXT;
  v_reason      TEXT;
  v_entity_id   UUID;
  v_field       TEXT;
  v_old         JSONB;
  v_new         JSONB;
BEGIN
  -- Read session context (NULL if not set)
  v_actor_id    := NULLIF(current_setting('app.actor_id', TRUE), '')::UUID;
  v_actor_email := NULLIF(current_setting('app.actor_email', TRUE), '');
  v_reason      := NULLIF(current_setting('app.audit_reason', TRUE), '');

  -- Entity id depends on the table
  IF TG_TABLE_NAME = 'seafields_lot_allocations' THEN
    v_entity_id := NULL;  -- lot_number is INTEGER, store in details JSON below
  ELSE
    v_entity_id := COALESCE(NEW.id, OLD.id);
  END IF;

  -- For UPDATE: diff every column, emit one audit row per changed field
  IF TG_OP = 'UPDATE' THEN
    FOR v_field, v_old, v_new IN
      SELECT key,
             to_jsonb(old_data) -> key,
             to_jsonb(new_data) -> key
      FROM jsonb_each(to_jsonb(OLD)) AS old_data(key, value)
      JOIN jsonb_each(to_jsonb(NEW)) AS new_data(key, value) USING (key)
      WHERE to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key
        AND key NOT IN ('updated_at')  -- ignore housekeeping columns
    LOOP
      INSERT INTO audit_log (
        actor_id, actor_email, action, entity_type, entity_id,
        field_changed, old_value, new_value, reason, details
      ) VALUES (
        v_actor_id, COALESCE(v_actor_email, 'system'),
        TG_OP || '_' || TG_TABLE_NAME,
        TG_TABLE_NAME, v_entity_id,
        v_field, v_old, v_new, v_reason,
        CASE WHEN TG_TABLE_NAME = 'seafields_lot_allocations'
             THEN jsonb_build_object('lot_number', NEW.lot_number)
             ELSE '{}'::jsonb END
      );
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
      actor_id, actor_email, action, entity_type, entity_id,
      new_value, reason, details
    ) VALUES (
      v_actor_id, COALESCE(v_actor_email, 'system'),
      'INSERT_' || TG_TABLE_NAME,
      TG_TABLE_NAME, v_entity_id,
      to_jsonb(NEW), v_reason,
      CASE WHEN TG_TABLE_NAME = 'seafields_lot_allocations'
           THEN jsonb_build_object('lot_number', NEW.lot_number)
           ELSE '{}'::jsonb END
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
      actor_id, actor_email, action, entity_type, entity_id,
      old_value, reason, details
    ) VALUES (
      v_actor_id, COALESCE(v_actor_email, 'system'),
      'DELETE_' || TG_TABLE_NAME,
      TG_TABLE_NAME, v_entity_id,
      to_jsonb(OLD), v_reason,
      CASE WHEN TG_TABLE_NAME = 'seafields_lot_allocations'
           THEN jsonb_build_object('lot_number', OLD.lot_number)
           ELSE '{}'::jsonb END
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_lots ON seafields_lot_allocations;
CREATE TRIGGER trg_audit_lots
  AFTER INSERT OR UPDATE OR DELETE ON seafields_lot_allocations
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

DROP TRIGGER IF EXISTS trg_audit_stages ON stages;
CREATE TRIGGER trg_audit_stages
  AFTER INSERT OR UPDATE OR DELETE ON stages
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

DROP TRIGGER IF EXISTS trg_audit_srl ON seafields_registration_lots;
CREATE TRIGGER trg_audit_srl
  AFTER INSERT OR UPDATE OR DELETE ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();
```

**Important:** the existing application-level `auditLog()` calls in `src/app/api/admin/seafields/allocations/[lotNumber]/route.ts` would now produce *two* audit rows per change — one from the app, one from the trigger. **Plan:** Phase 4.3 removes the redundant app-level calls when the route is updated. For the brief window between this migration applying and Phase 4.3 shipping, expect double-logging. Not a correctness issue, just noise.

**Session-variable plumbing for app code (Phase 4.3):** every admin Patch endpoint needs to wrap its UPDATE in a transaction that first runs `SET LOCAL app.actor_email = …` / `SET LOCAL app.audit_reason = …`. The Supabase JS client supports this via `.rpc()` or a raw SQL function. A small helper `withAuditContext(supabase, { actorEmail, reason }, async () => { …updates… })` is the cleanest pattern.

---

## 7. `updated_at` triggers on new tables

Mirror the existing `trg_seafields_lot_allocations_updated_at` pattern:

```sql
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stages_updated_at
  BEFORE UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_dwelling_types_updated_at
  BEFORE UPDATE ON dwelling_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_srl_updated_at
  BEFORE UPDATE ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

---

## 8. What this migration does NOT do

- Does not change `seafields_registrations` schema. `lots_selected text[]` stays.
- Does not drop, rename, or change the type of any existing column.
- Does not delete any rows.
- Does not change Branscombe or Hemp Homes schema (out of directive scope).
- Does not seed prices, dwelling assignments, or lot category/zone — those come from the workbook in Phase 4.2.
- Does not implement the stage-advance Postgres function (Section 5.5) — that's a Phase 5 deliverable.
- Does not wire email templates into a DB table — also Phase 5.
- Does not modify the admin panel or any API route — that's Phase 4.3.

---

## 9. Schema summary diagram (after migration)

```
                    stages                          dwelling_types
                    ──────                          ──────────────
                    id (PK)                         id (PK)
                    stage_number (unique 1–7)       code (unique)
                    rate_per_sqm                    plan_name, bedrooms, …
                    is_open_for_registration            ▲
                    auto_advance_threshold_pct          │
                    public_visible                      │
                          ▲                             │
                          │                             │
                          │ stage_id FK                 │ dwelling_type_id FK
                          │                             │
              seafields_lot_allocations  ───────────────┘
              ─────────────────────────
              lot_number (PK)
              sqm, x_pct, y_pct
              allocated_to (existing free-text)
              allocation_bucket (new enum)
              status (new enum)
              land_rate_override_per_sqm
              house_cost
              display_price_to_public
              public_label, internal_notes
              … plus all existing columns
                          ▲
                          │ lot_number FK
                          │
              seafields_registration_lots
              ───────────────────────────
              id (PK)
              registration_id FK ──── seafields_registrations (unchanged)
              lot_number FK
              registration_type ('primary' / 'backup_list')
              status ('active' / 'locked_in' / 'converted_to_sale' / 'cancelled' / 'released')
              position_in_queue
              stage_at_registration_id FK
              UNIQUE (registration_id, lot_number)

              audit_log (rows written by trigger on every change to lots/stages/srl)
              ─────────
              + field_changed, old_value (jsonb), new_value (jsonb), reason
              (immutable: INSERT + SELECT only for service_role)
```

---

## 10. Re-runnability check

Every statement in the migration is guarded:

| Statement type | Idempotency guard |
|---|---|
| `CREATE TABLE` | `IF NOT EXISTS` |
| `ALTER TABLE … ADD COLUMN` | `IF NOT EXISTS` |
| `CREATE INDEX` | `IF NOT EXISTS` |
| `CREATE POLICY` | `DROP POLICY IF EXISTS` before |
| `CREATE TRIGGER` | `DROP TRIGGER IF EXISTS` before |
| `CREATE OR REPLACE FUNCTION` | natively idempotent |
| `INSERT … seed` | `ON CONFLICT … DO NOTHING` |
| Back-fill `UPDATE`s | guarded with `WHERE … IS NULL` |

Re-running 0002 against a partially-applied DB should be a no-op.

---

## 11. Rollout sequence

1. **Local Supabase (if `supabase start` is wired)** — apply 0002, run smoke tests, verify the public site + admin panel still work against the local DB.
2. **Supabase branch / staging** — Supabase supports preview branches. Apply 0002 against a branch off the live project, smoke-test via a preview Vercel deploy.
3. **Snapshot live** — take a SQL dump (`pg_dump`) of the live DB before applying. Stored locally as `backups/pre-0002-<timestamp>.sql`.
4. **Apply to live** — via Supabase SQL editor or `supabase db push`. Watch logs for trigger fires.
5. **Post-apply verification** — run the verification queries in §13.
6. **Watchpoint window** — leave 24 hours before Phase 4.3 admin changes ship. Watch the audit_log table for unexpected entries from the new triggers; watch the public site for any anon-key reads that broke (§12.2).

---

## 12. Open questions before applying

### 12.1 Back-fill `stage` from `lots.ts` code constants?

`src/data/seafields/lots.ts` has every lot's stage hardcoded (`stage: "1"`, `"3"`, etc). The DB has these mostly NULL. Options:

- **(a) Yes, back-fill from code on migration.** Migration becomes "smart" — needs a script wrapper or a hand-translated INSERT statement listing every lot→stage pair (145 of them). Single source of truth in DB from Day 1 of the new schema.
- **(b) No, leave NULL in 0002; back-fill from workbook in 4.2.** Cleaner separation — schema migration moves schema, data migration moves data. Lots stay NULL until Uwe's workbook import lands.

**Recommendation: (b)**. Less code in the migration, single point of truth (workbook), and the admin pipeline page already gracefully handles NULL stage (it reads from `LOTS` constants for now).

Same applies for `category`, `zone`, `area_sqm` corrections — leave to Phase 4.2.

### 12.2 External consumers of the anon SELECT on `seafields_lot_allocations`?

After §3.7, anon can no longer SELECT directly from the base table — must go through `seafields_public_lots` view. Need to confirm:

- No external dashboard / spreadsheet / BI tool currently hits this table via the anon key.
- No client-side JS in `f2k-projects.vercel.app` reads the table directly (the public API routes use the service key, so they're safe).

Quick grep in this repo confirms no client-side anon read of `seafields_lot_allocations`. **External integrations are the unknown.** Dennis — do you know of any?

### 12.3 Audit-log immutability via RLS, or keep service_role ALL?

§5 proposes tightening so only INSERT+SELECT work for service_role. Cleaner but means even a one-off fix to a malformed audit row needs a policy change first.

**Recommendation:** start tight. We can loosen if a real correctness issue ever forces it.

### 12.4 `escalation_pct` — drop column, compute in view?

§1 prefers dropping it and computing via view. Confirms with directive spec — Section 3.1 lists it as "Computed: vs Stage 1 (% above)". Worth confirming Dennis is happy with view-only and no stored column.

### 12.5 Migration filename + author convention

Existing file: `0001_purchaser_schema.sql`. Suggested 0002 name: `0002_seafields_launch_schema.sql`. Or do we want to split this into smaller files (`0002_stages.sql`, `0003_dwelling_types.sql`, `0004_registration_lots.sql`, `0005_audit_trigger.sql`, `0006_public_view.sql`)? Splitting makes review easier and lets us pause between sub-migrations.

**Recommendation:** split. Five smaller files are easier to review and easier to roll back individually. The directive doesn't mandate a single file.

---

## 13. Post-apply verification queries

Run these after 0002 lands to confirm correctness:

```sql
-- 1. Stages table populated, only Stage 1 open
SELECT stage_number, stage_label, is_open_for_registration, public_visible
FROM stages ORDER BY stage_number;
-- Expect: 7 rows, only stage_number=1 has is_open_for_registration=TRUE

-- 2. Dwelling types seeded
SELECT code, plan_name, bedrooms, is_active FROM dwelling_types;
-- Expect: 7 rows

-- 3. Lots have status back-filled
SELECT status, COUNT(*) FROM seafields_lot_allocations GROUP BY status;
-- Expect: 'reserved' (count of WACHS/GROH lots), 'available' (rest)

-- 4. Allocation bucket back-fill (any NULLs that fell through?)
SELECT allocated_to, allocation_bucket, COUNT(*)
FROM seafields_lot_allocations
GROUP BY allocated_to, allocation_bucket
ORDER BY allocated_to NULLS LAST;
-- Expect: every row has allocation_bucket set; flag any (allocated_to NOT NULL, bucket NULL) for manual fix

-- 5. Registration_lots back-fill matches existing array data
SELECT COUNT(*) FROM seafields_registration_lots;
-- Expect: equal to sum of array_length(lots_selected) across seafields_registrations

-- 6. Audit trigger fires on a test update (do this carefully on a low-stakes lot in staging)
-- BEGIN;
--   SET LOCAL app.actor_email = 'test@factory2key.com.au';
--   SET LOCAL app.audit_reason = 'verification test';
--   UPDATE seafields_lot_allocations SET internal_notes = 'audit test' WHERE lot_number = 999999;  -- non-existent so no real change
--   SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '1 minute' ORDER BY created_at DESC;
-- ROLLBACK;

-- 7. Public view returns expected columns and respects display_price_to_public
SELECT lot_number, status, stage_number, effective_rate_per_sqm
FROM seafields_public_lots LIMIT 5;
```

---

## 14. What I need from Dennis before authoring SQL

Quick yes/no on the open questions:

1. **§12.1** — back-fill `stage` from code now (a), or wait for workbook (b)? **Recommend (b).**
2. **§12.2** — any external consumer of anon SELECT on `seafields_lot_allocations`? Best of your knowledge.
3. **§12.3** — audit-log immutability via RLS (recommended) vs keep service_role ALL?
4. **§12.4** — `escalation_pct` view-only, no stored column?
5. **§12.5** — single migration file (`0002_seafields_launch_schema.sql`), or split into five smaller files?
6. **§3.1 / allocation_bucket naming** — confirm option (a): keep existing `allocated_to` free-text, add `allocation_bucket` enum?

Once those are answered, I'll author the actual SQL file(s) and surface them for a second review before they hit any database.

**End of migration plan 0002.**
