-- F2K-Projects — Seafields launch schema, part 1 of 5
-- Catalogue tables: stages + dwelling_types.
--
-- Authored per /docs/migration-plan-0002.md §1 and §2.
-- Idempotent: safe to re-run.
-- Non-destructive: adds new tables only, no changes to existing schema.

-- =====================================================================
-- STAGES — one row per release stage, drives price ladder + auto-advance
-- =====================================================================

CREATE TABLE IF NOT EXISTS stages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number                INTEGER UNIQUE NOT NULL
    CHECK (stage_number BETWEEN 1 AND 7),
  stage_label                 TEXT NOT NULL,
  rate_per_sqm                NUMERIC(10, 2)
    CHECK (rate_per_sqm IS NULL OR rate_per_sqm >= 0),
  is_open_for_registration    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_advance_threshold_pct  NUMERIC(5, 2) NOT NULL DEFAULT 80.00
    CHECK (auto_advance_threshold_pct BETWEEN 0 AND 100),
  public_visible              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_open
  ON stages (stage_number) WHERE is_open_for_registration = TRUE;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stages_updated_at ON stages;
CREATE TRIGGER trg_stages_updated_at
  BEFORE UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_stages" ON stages;
CREATE POLICY "public_read_stages"
  ON stages FOR SELECT TO anon, authenticated
  USING (public_visible = TRUE);

DROP POLICY IF EXISTS "service_role_all_stages" ON stages;
CREATE POLICY "service_role_all_stages"
  ON stages FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Seed: 7 stages, only Stage 1 open per locked-in launch strategy.
-- rate_per_sqm NULL until Uwe enters from workbook via admin Stages UI.
INSERT INTO stages (stage_number, stage_label, is_open_for_registration, public_visible) VALUES
  (1, 'SW Block — Launch',     TRUE,  TRUE),
  (2, 'Pepper Gate Central',   FALSE, TRUE),
  (3, 'Central',               FALSE, TRUE),
  (4, 'Pepper Gate Inner',     FALSE, TRUE),
  (5, 'Central Upper',         FALSE, TRUE),
  (6, 'Collins Road',          FALSE, TRUE),
  (7, 'Final Release',         FALSE, TRUE)
ON CONFLICT (stage_number) DO NOTHING;

COMMENT ON TABLE stages IS
  'Release stages for Seafields Estate launch. Drives the $/m² price ladder, public visibility, and auto-advance threshold (Section 5.5 of launch directive).';

-- =====================================================================
-- DWELLING_TYPES — canonical catalogue of house plans
-- =====================================================================

CREATE TABLE IF NOT EXISTS dwelling_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  plan_name           TEXT NOT NULL,
  bedrooms            INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
  bathrooms           INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0),
  floor_area_sqm      NUMERIC(6, 2)
    CHECK (floor_area_sqm IS NULL OR floor_area_sqm > 0),
  build_cost_default  NUMERIC(12, 2)
    CHECK (build_cost_default IS NULL OR build_cost_default >= 0),
  display_label       TEXT,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dwelling_types_active
  ON dwelling_types (is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_dwelling_types_updated_at ON dwelling_types;
CREATE TRIGGER trg_dwelling_types_updated_at
  BEFORE UPDATE ON dwelling_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE dwelling_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_dwelling_types" ON dwelling_types;
CREATE POLICY "public_read_dwelling_types"
  ON dwelling_types FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "service_role_all_dwelling_types" ON dwelling_types;
CREATE POLICY "service_role_all_dwelling_types"
  ON dwelling_types FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Seed: union of admin dropdown values (2x2BR/3BR/4BR) and purchaser-facing
-- RegistrationForm options. Bedrooms/bathrooms partial; build_cost_default NULL
-- until Uwe enters from workbook via admin Dwelling Types UI.
INSERT INTO dwelling_types (code, plan_name, bedrooms, bathrooms, display_label) VALUES
  ('2x2BR-ADU',   '2x2 ADU / Granny Flat',   2,    1,    '2x1 ADU / Granny Flat'),
  ('3BR-MOD',     '3x2 Modular Home',        3,    2,    '3x2 Modular Home'),
  ('3BR-STU-MOD', '3x2 + Study Modular',     3,    2,    '3x2 + Study Modular'),
  ('4BR-MOD',     '4x2 Modular Home',        4,    2,    '4x2 Modular Home'),
  ('4BR-THE-MOD', '4x2 + Theatre Modular',   4,    2,    '4x2 + Theatre Modular'),
  ('5BR-MOD',     '5x2 Modular Home',        5,    2,    '5x2 Modular Home'),
  ('DUAL-OCC',    'Dual Occupancy',          NULL, NULL, 'Dual Occupancy')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE dwelling_types IS
  'Canonical catalogue of house plans available for Seafields Estate H&L packages. code is the canonical key; display_label is the purchaser-facing string.';
