-- F2K-Projects — Seafields launch schema, part 2 of 5
-- Additive columns on seafields_lot_allocations to support staged pricing,
-- status enum, allocation bucket, dwelling type FK, public display flags.
--
-- Authored per /docs/migration-plan-0002.md §3.
-- Idempotent: every ADD COLUMN is IF NOT EXISTS, every back-fill is guarded.
-- Non-destructive: no existing column renamed or dropped. Existing
-- `allocated_to text` and `stage text` columns keep working unchanged.
--
-- Prereqs: 0002_seafields_stages_dwelling_types.sql

-- =====================================================================
-- ADD COLUMNS
-- =====================================================================

ALTER TABLE seafields_lot_allocations
  ADD COLUMN IF NOT EXISTS stage_id                    UUID
    REFERENCES stages(id),
  ADD COLUMN IF NOT EXISTS dwelling_type_id            UUID
    REFERENCES dwelling_types(id),
  ADD COLUMN IF NOT EXISTS status                      TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS allocation_bucket           TEXT,
  ADD COLUMN IF NOT EXISTS category                    TEXT,
  ADD COLUMN IF NOT EXISTS zone                        TEXT,
  ADD COLUMN IF NOT EXISTS land_only                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS land_rate_override_per_sqm  NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS house_cost                  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS display_price_to_public     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_label                TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes              TEXT;

-- =====================================================================
-- CHECK CONSTRAINTS (added separately so re-runs don't choke on duplicates)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_status_check'
  ) THEN
    ALTER TABLE seafields_lot_allocations
      ADD CONSTRAINT sla_status_check
      CHECK (status IN ('available', 'reserved', 'withheld', 'sold', 'backup_list_only'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_allocation_bucket_check'
  ) THEN
    ALTER TABLE seafields_lot_allocations
      ADD CONSTRAINT sla_allocation_bucket_check
      CHECK (allocation_bucket IS NULL OR allocation_bucket IN (
        'public', 'groh', 'baurimus', 'takken', 'wachs',
        'f2k_withheld', 'display_home', 'heritage_retained'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_land_rate_override_check'
  ) THEN
    ALTER TABLE seafields_lot_allocations
      ADD CONSTRAINT sla_land_rate_override_check
      CHECK (land_rate_override_per_sqm IS NULL OR land_rate_override_per_sqm >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_house_cost_check'
  ) THEN
    ALTER TABLE seafields_lot_allocations
      ADD CONSTRAINT sla_house_cost_check
      CHECK (house_cost IS NULL OR house_cost >= 0);
  END IF;
END $$;

-- =====================================================================
-- INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_sla_stage_id
  ON seafields_lot_allocations (stage_id) WHERE stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sla_status
  ON seafields_lot_allocations (status);

CREATE INDEX IF NOT EXISTS idx_sla_bucket
  ON seafields_lot_allocations (allocation_bucket) WHERE allocation_bucket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sla_dwelling_type
  ON seafields_lot_allocations (dwelling_type_id) WHERE dwelling_type_id IS NOT NULL;

-- =====================================================================
-- BACK-FILL: allocation_bucket from existing allocated_to free-text
-- =====================================================================
-- Maps existing string values to the new enum. Rows that fall through to
-- NULL after this UPDATE need manual classification by Uwe/Dennis before
-- launch.
--
-- Per /docs/migration-plan-0002.md §3.1 option (a) — additive, no rename.

UPDATE seafields_lot_allocations
SET allocation_bucket = CASE
  WHEN allocated_to IS NULL                       THEN 'public'
  WHEN allocated_to ILIKE 'WACHS%'                THEN 'wachs'
  WHEN allocated_to ILIKE 'GROH%'                 THEN 'groh'
  WHEN allocated_to ILIKE '%takken%'              THEN 'takken'
  WHEN allocated_to ILIKE '%baurimus%'            THEN 'baurimus'
  WHEN allocated_to ILIKE '%f2k%'                 THEN 'f2k_withheld'
  WHEN allocated_to ILIKE '%display%home%'        THEN 'display_home'
  WHEN allocated_to ILIKE '%heritage%'            THEN 'heritage_retained'
  ELSE NULL
END
WHERE allocation_bucket IS NULL;

-- =====================================================================
-- BACK-FILL: status from existing allocated_to
-- =====================================================================
-- Lots with any institutional or counterparty allocation are 'reserved'.
-- All others stay at the default 'available'. Heritage lots will be
-- updated to 'withheld' once allocation_bucket is set to 'heritage_retained'
-- (driven from workbook bulk import in Phase 4.2 — see open question §12.1).

UPDATE seafields_lot_allocations
SET status = 'reserved'
WHERE allocated_to IS NOT NULL
  AND status = 'available';

-- =====================================================================
-- BACK-FILL: dwelling_type_id from existing dwelling_type free-text
-- =====================================================================

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

-- =====================================================================
-- BACK-FILL: stage_id from existing stage text column
-- =====================================================================
-- Only back-fills rows where DB.stage is non-NULL. Lots with stage NULL
-- in the DB but stage set in src/data/seafields/lots.ts stay NULL here
-- — they get populated by the Phase 4.2 workbook bulk import.

UPDATE seafields_lot_allocations sla
SET stage_id = s.id
FROM stages s
WHERE sla.stage_id IS NULL
  AND sla.stage IS NOT NULL
  AND sla.stage ~ '^[1-7]$'
  AND s.stage_number = sla.stage::INTEGER;

COMMENT ON COLUMN seafields_lot_allocations.allocation_bucket IS
  'Canonical enum bucket (public/groh/baurimus/takken/wachs/f2k_withheld/display_home/heritage_retained). Drives RLS + auto-advance threshold filtering. The existing allocated_to free-text column keeps the counterparty label.';

COMMENT ON COLUMN seafields_lot_allocations.status IS
  'Lot status enum. Derived initially from allocated_to; managed by admin going forward. Drives the public lot card render path.';

COMMENT ON COLUMN seafields_lot_allocations.land_rate_override_per_sqm IS
  'Per-lot override of stages.rate_per_sqm. NULL means use the stage rate. Used for institutional allocations on negotiated terms.';
