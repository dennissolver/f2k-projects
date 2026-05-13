-- F2K-Projects (Purchaser Portal) — initial schema
-- Apply once to the new Supabase project (earqebbwhklxadqawtex).
-- Idempotent: safe to re-run.
--
-- Includes only the tables the public projects site needs:
--   - audit_log: action log for ROI submissions
--   - seafields_registrations: purchaser ROI for Seafields Estate (Geraldton WA)
--   - branscombe_registrations: purchaser ROI for Branscombe Estate (Claremont TAS)
--   - seafields_lot_allocations: authoritative lot register + pre-allocations
--   - branscombe_unit_allocations: authoritative unit register
--
-- Does NOT include any fund-side schema (investors, tokens, NAV, distributions,
-- subscriptions, etc.). Those live on the fund repo's Supabase only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- AUDIT LOG
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  details      JSONB DEFAULT '{}',
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_audit_log" ON audit_log;
CREATE POLICY "service_role_all_audit_log"
  ON audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================================
-- SEAFIELDS REGISTRATIONS (purchaser ROI)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seafields_registrations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT,
  lots_selected        TEXT[] NOT NULL DEFAULT '{}',
  interest_type        TEXT,
  price_preferences    JSONB NOT NULL DEFAULT '{}',
  dwelling_preferences JSONB NOT NULL DEFAULT '{}',
  suburb               TEXT,
  postcode             TEXT,
  buyer_type           TEXT,
  buyer_profile        TEXT,
  current_housing      TEXT,
  purchase_timeline    TEXT,
  finance_status       TEXT,
  how_heard            TEXT,
  referrer_type        TEXT,
  referrer_name        TEXT,
  referrer_company     TEXT,
  referrer_contact     TEXT,
  notes                TEXT,
  consent              BOOLEAN NOT NULL DEFAULT FALSE,
  source               TEXT NOT NULL DEFAULT 'web-roi',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seafields_reg_lots
  ON seafields_registrations USING GIN (lots_selected);
CREATE INDEX IF NOT EXISTS idx_seafields_reg_created
  ON seafields_registrations (created_at DESC);

ALTER TABLE seafields_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_seafields_registrations" ON seafields_registrations;
CREATE POLICY "service_role_all_seafields_registrations"
  ON seafields_registrations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public anon read of aggregated lot counts is via API route (uses service key
-- to count `lots_selected`). No direct anon SELECT exposes raw PII.

COMMENT ON TABLE seafields_registrations IS
  'Registration of interest for Seafields Estate (Pepper Gate, Waggrakine WA 6530). Purchaser-side, real estate marketing only.';

-- =====================================================================
-- BRANSCOMBE REGISTRATIONS (purchaser ROI)
-- =====================================================================

CREATE TABLE IF NOT EXISTS branscombe_registrations (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  units_selected    TEXT[] NOT NULL DEFAULT '{}',
  price_preferences JSONB NOT NULL DEFAULT '{}',
  suburb            TEXT,
  postcode          TEXT,
  buyer_type        TEXT,
  buyer_profile     TEXT,
  current_housing   TEXT,
  purchase_timeline TEXT,
  finance_status    TEXT,
  how_heard         TEXT,
  referrer_type     TEXT,
  referrer_name     TEXT,
  referrer_company  TEXT,
  referrer_contact  TEXT,
  notes             TEXT,
  consent           BOOLEAN NOT NULL DEFAULT FALSE,
  source            TEXT NOT NULL DEFAULT 'web-roi',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branscombe_reg_units
  ON branscombe_registrations USING GIN (units_selected);
CREATE INDEX IF NOT EXISTS idx_branscombe_reg_created
  ON branscombe_registrations (created_at DESC);

ALTER TABLE branscombe_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_branscombe_registrations" ON branscombe_registrations;
CREATE POLICY "service_role_all_branscombe_registrations"
  ON branscombe_registrations
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE branscombe_registrations IS
  'Registration of interest for Branscombe Estate (122-124 Branscombe Rd, Claremont TAS). Purchaser-side, real estate marketing only.';

-- =====================================================================
-- SEAFIELDS LOT ALLOCATIONS (admin-managed inventory + government pre-allocations)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seafields_lot_allocations (
  lot_number                       INTEGER PRIMARY KEY,
  sqm                              INTEGER NOT NULL CHECK (sqm > 0),
  allocated_to                     TEXT,
  dwelling_type                    TEXT,
  stage                            TEXT,
  x_pct                            NUMERIC(5,2),
  y_pct                            NUMERIC(5,2),
  wholesale_price                  NUMERIC(12, 2)
    CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
  retail_price                     NUMERIC(12, 2)
    CHECK (retail_price IS NULL OR retail_price >= 0),
  intent_locked_to_registration_id UUID
    REFERENCES seafields_registrations(id) ON DELETE SET NULL,
  intent_locked_at                 TIMESTAMPTZ,
  intent_locked_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by                      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at                      TIMESTAMPTZ,
  notes                            TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seafields_allocations_allocated_to
  ON seafields_lot_allocations (allocated_to)
  WHERE allocated_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seafields_allocations_stage
  ON seafields_lot_allocations (stage)
  WHERE stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seafields_allocations_intent_locked_to
  ON seafields_lot_allocations (intent_locked_to_registration_id)
  WHERE intent_locked_to_registration_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_seafields_lot_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seafields_lot_allocations_updated_at
  ON seafields_lot_allocations;
CREATE TRIGGER trg_seafields_lot_allocations_updated_at
  BEFORE UPDATE ON seafields_lot_allocations
  FOR EACH ROW EXECUTE FUNCTION update_seafields_lot_allocations_updated_at();

ALTER TABLE seafields_lot_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_seafields_allocations" ON seafields_lot_allocations;
CREATE POLICY "public_read_seafields_allocations"
  ON seafields_lot_allocations
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "service_role_all_seafields_allocations" ON seafields_lot_allocations;
CREATE POLICY "service_role_all_seafields_allocations"
  ON seafields_lot_allocations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Seed data (WACHS/GROH pre-allocations + centroids). Idempotent via ON CONFLICT.
INSERT INTO seafields_lot_allocations (lot_number, sqm, allocated_to, dwelling_type, stage, x_pct, y_pct) VALUES
  (85, 600, NULL, NULL, NULL, 68.9, 72.81),
  (86, 600, NULL, NULL, NULL, 71.19, 74.31),
  (87, 600, NULL, NULL, NULL, NULL, NULL),
  (88, 600, NULL, NULL, NULL, 77.17, 78.69),
  (89, 600, NULL, NULL, NULL, NULL, NULL),
  (90, 600, NULL, NULL, NULL, NULL, NULL),
  (91, 600, NULL, NULL, NULL, NULL, NULL),
  (109, 600, NULL, NULL, NULL, NULL, NULL),
  (110, 600, NULL, NULL, NULL, NULL, NULL),
  (111, 600, NULL, NULL, NULL, NULL, NULL),
  (200, 834, NULL, NULL, NULL, 88.23, 76.88),
  (201, 834, NULL, NULL, NULL, 87.65, 72.29),
  (202, 600, NULL, NULL, NULL, NULL, NULL),
  (203, 600, NULL, NULL, NULL, NULL, NULL),
  (204, 600, NULL, NULL, NULL, NULL, NULL),
  (205, 600, NULL, NULL, NULL, 76.97, 72.12),
  (206, 600, NULL, NULL, NULL, 74.62, 70.63),
  (207, 600, NULL, NULL, NULL, 71.26, 68.22),
  (208, 600, NULL, NULL, NULL, 69.01, 66.96),
  (209, 600, NULL, NULL, NULL, 68.79, 57.18),
  (210, 600, NULL, NULL, NULL, 72.68, 53.83),
  (211, 600, NULL, NULL, NULL, NULL, NULL),
  (212, 600, NULL, NULL, NULL, 77.52, 56.22),
  (213, 600, NULL, NULL, NULL, 79.53, 57.47),
  (214, 600, NULL, NULL, NULL, 79.66, 64.06),
  (215, 600, NULL, NULL, NULL, 77.6, 62.1),
  (216, 600, NULL, NULL, NULL, 75.72, 60.91),
  (217, 600, NULL, NULL, NULL, NULL, NULL),
  (218, 600, NULL, NULL, NULL, 70.72, 58.37),
  (219, 600, NULL, NULL, NULL, 83.92, 65.84),
  (220, 600, NULL, NULL, NULL, 84.24, 60.88),
  (221, 600, NULL, NULL, NULL, 84.37, 57.6),
  (222, 600, NULL, NULL, NULL, 84.95, 54.54),
  (223, 600, NULL, NULL, NULL, 85.03, 51.1),
  (224, 600, NULL, NULL, NULL, 85.18, 47.66),
  (225, 600, NULL, NULL, NULL, 85.53, 43.68),
  (226, 600, NULL, NULL, NULL, 89.82, 40.34),
  (227, 600, NULL, NULL, NULL, 89.32, 44.5),
  (228, 600, NULL, NULL, NULL, 89.21, 47.94),
  (229, 600, NULL, NULL, NULL, 89.09, 51.39),
  (230, 600, NULL, NULL, NULL, 88.96, 54.83),
  (231, 600, NULL, NULL, NULL, 88.81, 58.31),
  (232, 600, NULL, NULL, NULL, 88.06, 61.09),
  (233, 600, NULL, NULL, NULL, 89.29, 66.12),
  (234, 600, NULL, NULL, NULL, 86.62, 66.02),
  (235, 600, NULL, NULL, NULL, 78.98, 46.25),
  (236, 445, 'WACHS', '2x2BR', NULL, 88.67, 30.16),
  (237, 445, 'WACHS', '2x2BR', NULL, 88.61, 32.52),
  (238, 445, 'WACHS', '2x2BR', NULL, 88.44, 35.25),
  (239, 445, NULL, NULL, NULL, 85.03, 40.38),
  (240, 445, NULL, NULL, NULL, 85.21, 37.54),
  (241, 445, NULL, NULL, NULL, 84.75, 33.04),
  (242, 445, NULL, NULL, NULL, 85.38, 31.99),
  (243, 445, NULL, NULL, NULL, 79.4, 30.19),
  (244, 445, NULL, NULL, NULL, NULL, NULL),
  (245, 445, NULL, NULL, NULL, 79.36, 35.01),
  (246, 445, NULL, NULL, NULL, 79.32, 37.33),
  (247, 445, NULL, NULL, NULL, 79.27, 39.82),
  (248, 445, NULL, NULL, NULL, 79.25, 42.53),
  (249, 445, NULL, NULL, NULL, NULL, NULL),
  (250, 602, NULL, NULL, NULL, 75.81, 42.05),
  (251, 602, NULL, NULL, NULL, 75.77, 39.73),
  (252, 602, NULL, NULL, NULL, 75.78, 37.41),
  (253, 602, NULL, NULL, NULL, 75.86, 36.93),
  (254, 602, NULL, NULL, NULL, 75.77, 32.7),
  (255, 602, NULL, NULL, NULL, 75.76, 30.22),
  (256, 602, NULL, NULL, NULL, 70.31, 51.88),
  (257, 251, NULL, NULL, NULL, 66.88, 53.4),
  (258, 251, NULL, NULL, NULL, NULL, NULL),
  (259, 251, NULL, NULL, NULL, 65.18, 58.89),
  (260, 251, NULL, NULL, NULL, 66.9, 58.82),
  (261, 251, NULL, NULL, NULL, 66.82, 66.21),
  (262, 251, NULL, NULL, NULL, NULL, NULL),
  (263, 251, NULL, NULL, NULL, NULL, NULL),
  (264, 251, NULL, NULL, NULL, NULL, NULL),
  (265, 251, NULL, NULL, NULL, NULL, NULL),
  (266, 251, NULL, NULL, NULL, NULL, NULL),
  (267, 251, NULL, NULL, NULL, NULL, NULL),
  (268, 251, NULL, NULL, NULL, 54.38, 67.42),
  (269, 251, NULL, NULL, NULL, NULL, NULL),
  (270, 251, NULL, NULL, NULL, 57.8, 59.2),
  (271, 251, NULL, NULL, NULL, NULL, NULL),
  (272, 251, NULL, NULL, NULL, NULL, NULL),
  (273, 251, NULL, NULL, NULL, 60.94, 54.9),
  (274, 251, NULL, NULL, NULL, 60.35, 52.06),
  (275, 251, NULL, NULL, NULL, 60.86, 49.75),
  (276, 251, NULL, NULL, NULL, 60.32, 44.76),
  (277, 251, NULL, NULL, NULL, 60.33, 42.12),
  (278, 251, NULL, NULL, NULL, 60.32, 39.63),
  (279, 251, NULL, NULL, NULL, 60.31, 37.24),
  (280, 251, NULL, NULL, NULL, 60.31, 34.83),
  (281, 251, NULL, NULL, NULL, 60.28, 32.09),
  (282, 251, NULL, NULL, NULL, 60.29, 29.5),
  (283, 251, NULL, NULL, NULL, 60.28, 26.82),
  (284, 251, NULL, NULL, NULL, 56.46, 26.86),
  (285, 251, NULL, NULL, NULL, 56.48, 29.55),
  (286, 251, NULL, NULL, NULL, 56.5, 32.13),
  (287, 251, NULL, NULL, NULL, 56.54, 34.85),
  (288, 251, NULL, NULL, NULL, 56.51, 37.31),
  (289, 251, NULL, NULL, NULL, 56.51, 39.67),
  (290, 251, NULL, NULL, NULL, 56.52, 42.15),
  (291, 251, NULL, NULL, NULL, 56.52, 44.81),
  (292, 251, NULL, NULL, NULL, 56.58, 49.82),
  (293, 251, NULL, NULL, NULL, 56.91, 52.31),
  (294, 251, NULL, NULL, NULL, 56.54, 54.65),
  (295, 251, NULL, NULL, NULL, 50.68, 28.3),
  (296, 251, NULL, NULL, NULL, 50.63, 29.62),
  (297, 251, NULL, NULL, NULL, 50.68, 33.95),
  (298, 251, NULL, NULL, NULL, 50.65, 34.91),
  (299, 251, NULL, NULL, NULL, 50.64, 37.56),
  (300, 251, NULL, NULL, NULL, 50.65, 40.23),
  (301, 251, NULL, NULL, NULL, 50.67, 42.85),
  (302, 251, NULL, NULL, NULL, 50.76, 47.98),
  (303, 251, NULL, NULL, NULL, 50.67, 50.65),
  (304, 251, NULL, NULL, NULL, 50.71, 53.19),
  (305, 251, NULL, NULL, NULL, 50.7, 55.57),
  (306, 251, NULL, NULL, NULL, 50.71, 57.87),
  (307, 600, NULL, NULL, NULL, 52.03, 61.69),
  (308, 600, NULL, NULL, NULL, NULL, NULL),
  (309, 600, NULL, NULL, NULL, 45.9, 65.75),
  (310, 600, NULL, NULL, NULL, 46.62, 62.15),
  (311, 600, NULL, NULL, NULL, NULL, NULL),
  (312, 600, NULL, NULL, NULL, 43.2, 61.78),
  (313, 600, NULL, NULL, NULL, NULL, NULL),
  (314, 600, NULL, NULL, NULL, NULL, NULL),
  (315, 600, NULL, NULL, NULL, 41.08, 66.58),
  (316, 600, NULL, NULL, NULL, NULL, NULL),
  (317, 600, NULL, NULL, NULL, NULL, NULL),
  (318, 600, NULL, NULL, NULL, NULL, NULL),
  (319, 600, NULL, NULL, NULL, 35.5, 72.16),
  (320, 600, NULL, NULL, NULL, NULL, NULL),
  (321, 600, NULL, NULL, NULL, NULL, NULL),
  (322, 600, NULL, NULL, NULL, NULL, NULL),
  (323, 600, NULL, NULL, NULL, 27.09, 77.45),
  (324, 600, NULL, NULL, NULL, 26.92, 73.01),
  (325, 600, NULL, NULL, NULL, 26.77, 68.88),
  (326, 600, NULL, NULL, NULL, NULL, NULL),
  (327, 600, NULL, NULL, NULL, NULL, NULL),
  (328, 600, NULL, NULL, NULL, NULL, NULL),
  (329, 600, NULL, NULL, NULL, NULL, NULL),
  (330, 600, NULL, NULL, NULL, 37.55, 63.71),
  (331, 600, NULL, NULL, NULL, 36.44, 60.83),
  (332, 600, 'GROH', '2x2BR', NULL, NULL, NULL),
  (333, 600, 'WACHS', '2x2BR', NULL, NULL, NULL),
  (334, 600, NULL, NULL, NULL, NULL, NULL),
  (335, 600, 'GROH', '2x2BR', NULL, 76.01, 31.15),
  (336, 600, 'GROH', '3BR', NULL, 20.34, 61.12),
  (337, 600, 'WACHS', '4BR', NULL, 19.28, 63.03),
  (338, 600, 'GROH', '3BR', NULL, 20.41, 66.26),
  (339, 600, 'WACHS', '4BR', NULL, 19.32, 67.71),
  (340, 600, 'GROH', '3BR', NULL, 19.32, 70.07),
  (341, 600, 'WACHS', '4BR', NULL, 19.31, 72.53),
  (342, 600, 'WACHS', '4BR', NULL, 19.36, 75.19),
  (343, 600, 'GROH', '3BR', NULL, 20.36, 79.33),
  (344, 600, 'GROH', '4BR', NULL, 16.03, 79.44),
  (345, 600, 'GROH', '3BR', NULL, 16.08, 76.63),
  (346, 600, 'GROH', '4BR', NULL, 16.08, 73.86),
  (347, 600, 'GROH', '3BR', NULL, 15.21, 70.08),
  (348, 600, 'GROH', '4BR', NULL, 15.22, 67.75),
  (349, 600, 'WACHS', '4BR', NULL, 15.21, 65.41),
  (350, 600, 'GROH', '4BR', NULL, 16.03, 63.81),
  (351, 600, 'WACHS', '4BR', NULL, 15.16, 60.61),
  (352, 600, NULL, NULL, NULL, NULL, NULL),
  (353, 600, NULL, NULL, NULL, NULL, NULL),
  (354, 600, NULL, NULL, NULL, 52.86, 19.17),
  (355, 600, NULL, NULL, NULL, 54.49, 19.16),
  (356, 600, NULL, NULL, NULL, 56.25, 19.15),
  (357, 600, NULL, NULL, NULL, NULL, NULL),
  (358, 600, NULL, NULL, NULL, NULL, NULL),
  (359, 600, NULL, NULL, NULL, NULL, NULL),
  (360, 600, NULL, NULL, NULL, NULL, NULL),
  (361, 600, NULL, NULL, NULL, NULL, NULL),
  (362, 600, NULL, NULL, NULL, NULL, NULL),
  (363, 600, NULL, NULL, NULL, NULL, NULL),
  (364, 600, NULL, NULL, NULL, 70.0, 19.04),
  (365, 600, NULL, NULL, NULL, 71.85, 19.04),
  (366, 600, NULL, NULL, NULL, 71.8, 13.16),
  (367, 600, NULL, NULL, NULL, 74.95, 13.78),
  (368, 600, NULL, NULL, NULL, NULL, NULL),
  (369, 600, NULL, NULL, NULL, 69.97, 13.21),
  (426, 600, NULL, NULL, NULL, 54.81, 73.86),
  (427, 600, NULL, NULL, NULL, 56.95, 72.51),
  (428, 600, NULL, NULL, NULL, 59.8, 73.58),
  (429, 600, NULL, NULL, NULL, 61.7, 72.31),
  (430, 600, NULL, NULL, NULL, 63.95, 72.22),
  (431, 600, NULL, NULL, NULL, 66.45, 72.05),
  (432, 600, NULL, NULL, NULL, NULL, NULL),
  (433, 600, NULL, NULL, NULL, NULL, NULL),
  (434, 600, NULL, NULL, NULL, NULL, NULL),
  (442, 600, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (lot_number) DO NOTHING;

COMMENT ON TABLE seafields_lot_allocations IS
  'Authoritative lot register for Seafields Estate. Admin-managed allocations complement seafields_registrations.';

-- =====================================================================
-- BRANSCOMBE UNIT ALLOCATIONS (admin-managed 37-unit inventory)
-- =====================================================================

CREATE TABLE IF NOT EXISTS branscombe_unit_allocations (
  unit_number                      INTEGER PRIMARY KEY CHECK (unit_number BETWEEN 1 AND 37),
  home_type                        TEXT NOT NULL CHECK (home_type IN ('1A', '1B', '2A', '2B', '2C')),
  area_m2                          NUMERIC(6, 2) NOT NULL CHECK (area_m2 > 0),
  allocated_to                     TEXT,
  dwelling_type                    TEXT,
  notes                            TEXT,
  wholesale_price                  NUMERIC(12, 2)
    CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
  retail_price                     NUMERIC(12, 2)
    CHECK (retail_price IS NULL OR retail_price >= 0),
  intent_locked_to_registration_id UUID
    REFERENCES branscombe_registrations(id) ON DELETE SET NULL,
  intent_locked_at                 TIMESTAMPTZ,
  intent_locked_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by                      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at                      TIMESTAMPTZ,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branscombe_allocations_allocated_to
  ON branscombe_unit_allocations (allocated_to)
  WHERE allocated_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branscombe_allocations_home_type
  ON branscombe_unit_allocations (home_type);

CREATE INDEX IF NOT EXISTS idx_branscombe_allocations_intent_locked_to
  ON branscombe_unit_allocations (intent_locked_to_registration_id)
  WHERE intent_locked_to_registration_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_branscombe_unit_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branscombe_unit_allocations_updated_at
  ON branscombe_unit_allocations;
CREATE TRIGGER trg_branscombe_unit_allocations_updated_at
  BEFORE UPDATE ON branscombe_unit_allocations
  FOR EACH ROW EXECUTE FUNCTION update_branscombe_unit_allocations_updated_at();

ALTER TABLE branscombe_unit_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_branscombe_allocations" ON branscombe_unit_allocations;
CREATE POLICY "public_read_branscombe_allocations"
  ON branscombe_unit_allocations
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "service_role_all_branscombe_allocations" ON branscombe_unit_allocations;
CREATE POLICY "service_role_all_branscombe_allocations"
  ON branscombe_unit_allocations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

INSERT INTO branscombe_unit_allocations (unit_number, area_m2, home_type) VALUES
  (1, 93.6, '1A'),
  (2, 93.6, '1B'),
  (3, 93.6, '1A'),
  (4, 93.6, '2A'),
  (5, 106.1, '2B'),
  (6, 106.1, '2C'),
  (7, 93.6, '1B'),
  (8, 93.6, '2A'),
  (9, 93.6, '1A'),
  (10, 93.6, '2B'),
  (11, 93.6, '1A'),
  (12, 112.5, '1B'),
  (13, 112.5, '2A'),
  (14, 93.6, '1A'),
  (15, 112.5, '2B'),
  (16, 93.6, '2C'),
  (17, 112.5, '1B'),
  (18, 93.6, '2A'),
  (19, 112.5, '1A'),
  (20, 93.6, '2B'),
  (21, 112.5, '2C'),
  (22, 93.6, '1A'),
  (23, 108.2, '1B'),
  (24, 93.6, '2A'),
  (25, 108.2, '2B'),
  (26, 93.6, '2C'),
  (27, 108.2, '1A'),
  (28, 93.6, '1B'),
  (29, 108.2, '2A'),
  (30, 108.2, '2B'),
  (31, 93.3, '2C'),
  (32, 93.6, '1A'),
  (33, 108.2, '1B'),
  (34, 93.6, '2A'),
  (35, 93.6, '2B'),
  (36, 93.6, '2C'),
  (37, 93.6, '1A')
ON CONFLICT (unit_number) DO NOTHING;

COMMENT ON TABLE branscombe_unit_allocations IS
  'Authoritative per-unit register for Branscombe Estate. 37 single-storey homes on combined parcels 122 + 124 Branscombe Rd Claremont TAS 7011. Admin-managed allocations complement branscombe_registrations.';

-- =====================================================================
-- HEMP HOMES WAITLIST (purchaser ROI, separate dedupe model)
-- =====================================================================

CREATE TABLE IF NOT EXISTS hemp_homes_waitlist (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  program_slug          TEXT NOT NULL,

  -- contact
  full_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  suburb                TEXT,
  state                 TEXT,
  postcode              TEXT,

  -- interest profile
  i_am_a                TEXT,
  situation             TEXT,
  timeframe             TEXT,
  finance_status        TEXT,
  hear_about            TEXT,

  -- program-specific
  regions_of_interest   TEXT[] NOT NULL DEFAULT '{}',
  preferred_config      TEXT,
  build_preference      TEXT,
  journey_interests     TEXT[] NOT NULL DEFAULT '{}',
  what_drew_you         TEXT,

  -- referrer (optional)
  referrer_type         TEXT,
  referrer_name         TEXT,
  referrer_company      TEXT,
  referrer_contact      TEXT,

  notes                 TEXT,

  -- consent + audit
  consent_at            TIMESTAMPTZ NOT NULL,
  source                TEXT NOT NULL DEFAULT 'web-roi',
  user_agent            TEXT,
  ip_hash               TEXT,
  ghl_synced_at         TIMESTAMPTZ,
  confirmation_sent_at  TIMESTAMPTZ
);

-- Dedupe: same person, same program → single row
CREATE UNIQUE INDEX IF NOT EXISTS idx_hemp_homes_waitlist_email_program
  ON hemp_homes_waitlist (email, program_slug);

CREATE INDEX IF NOT EXISTS idx_hemp_homes_waitlist_created
  ON hemp_homes_waitlist (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hemp_homes_waitlist_ghl_pending
  ON hemp_homes_waitlist (created_at) WHERE ghl_synced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hemp_homes_waitlist_confirmation_pending
  ON hemp_homes_waitlist (created_at) WHERE confirmation_sent_at IS NULL;

ALTER TABLE hemp_homes_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_hemp_homes_waitlist" ON hemp_homes_waitlist;
CREATE POLICY "service_role_all_hemp_homes_waitlist"
  ON hemp_homes_waitlist
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE hemp_homes_waitlist IS
  'Registration of interest for Hemp Homes for Eco-Communities program. Purchaser-side, real estate marketing only.';

-- =====================================================================
-- ADMIN USERS (Uwe, Dennis, Tanveer, Lennie — purchaser portal admins)
-- =====================================================================
--
-- Setup workflow per admin:
--   1. Invite via Supabase Dashboard → Authentication → Users → Invite User
--      (sends a magic-link email; user sets a password on first sign-in).
--   2. After they accept and an auth.users row exists, run:
--        INSERT INTO admin_users (auth_user_id, email, role, full_name)
--        SELECT id, email, 'super_admin', '<full name>'
--        FROM auth.users WHERE email = '<email>'
--        ON CONFLICT (email) DO NOTHING;
--
-- Currently seeded as commented-out templates below — uncomment after
-- each invite is accepted, OR run the SELECT-INSERT above per user.

CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL CHECK (role IN ('super_admin', 'fund_manager', 'compliance', 'read_only')),
  full_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_auth ON admin_users (auth_user_id);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_admin_users" ON admin_users;
CREATE POLICY "service_role_all_admin_users"
  ON admin_users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- After inviting Dennis, Uwe, Tanveer, Lennie via Supabase Dashboard,
-- run the four templates below (uncomment + replace full_name if needed):
--
-- INSERT INTO admin_users (auth_user_id, email, role, full_name)
--   SELECT id, 'dennis@factory2key.com.au', 'super_admin', 'Dennis McMahon'
--   FROM auth.users WHERE email = 'dennis@factory2key.com.au'
--   ON CONFLICT (email) DO NOTHING;
--
-- INSERT INTO admin_users (auth_user_id, email, role, full_name)
--   SELECT id, 'uwe@factory2key.com.au', 'super_admin', 'Uwe Jacobs'
--   FROM auth.users WHERE email = 'uwe@factory2key.com.au'
--   ON CONFLICT (email) DO NOTHING;
--
-- INSERT INTO admin_users (auth_user_id, email, role, full_name)
--   SELECT id, 'tanveer@factory2key.com.au', 'super_admin', 'Tanveer'
--   FROM auth.users WHERE email = 'tanveer@factory2key.com.au'
--   ON CONFLICT (email) DO NOTHING;
--
-- INSERT INTO admin_users (auth_user_id, email, role, full_name)
--   SELECT id, 'lennie@factory2key.com.au', 'super_admin', 'Lennie'
--   FROM auth.users WHERE email = 'lennie@factory2key.com.au'
--   ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE admin_users IS
  'Admin users authorised to manage Factory2Key Projects allocations and registrations. Linked to auth.users via auth_user_id. Insert AFTER inviting the user via Supabase Auth.';

-- =====================================================================
-- RACE-FREE ADMIN LINKING
-- =====================================================================
-- Pre-creates admin_users rows for the 4 super_admins with auth_user_id = NULL,
-- and installs an AFTER INSERT trigger on auth.users that auto-links the FK
-- when the user accepts their invite and a matching auth.users row appears.
-- Plus a one-shot reconciliation for any auth users that already exist.
--
-- After this runs, Dennis can invite admins via Supabase Dashboard → Auth →
-- Users → Invite User. As each accepts, the trigger links them automatically.
-- No timing trap; no second SQL step.

INSERT INTO admin_users (email, role, full_name) VALUES
  ('dennis@factory2key.com.au', 'super_admin', 'Dennis McMahon'),
  ('uwe@factory2key.com.au', 'super_admin', 'Uwe Jacobs'),
  ('tanveer@propertyfriends.com.au', 'super_admin', 'Tanveer'),
  ('team@propertyfriends.com.au', 'super_admin', 'Lennie')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION link_admin_user_on_auth_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.admin_users
    SET auth_user_id = NEW.id
    WHERE email = NEW.email AND auth_user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS link_admin_user_trigger ON auth.users;
CREATE TRIGGER link_admin_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_admin_user_on_auth_create();

-- One-shot reconciliation: link any auth users that exist already
UPDATE public.admin_users a
  SET auth_user_id = u.id
  FROM auth.users u
  WHERE a.email = u.email
    AND a.auth_user_id IS NULL;
