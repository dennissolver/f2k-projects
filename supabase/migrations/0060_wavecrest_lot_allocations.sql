-- Wavecrest Estate — authoritative lot register (lots 83–115)
-- Mirrors seafields_lot_allocations (0001) + the extra columns the Wavecrest
-- guidance (docs/WAVECREST_ESTATE_PAGE_UPDATE_GUIDANCE.md) calls for:
--   status, area_confidence, public_label, land_only, retail_price, dwelling_type.
--
-- Data source: docs/wavecrest-lot-schedule.DRAFT.csv (33 rows).
-- Provenance per row preserved in `notes` (from the CSV internal_notes).
--
-- KEY DATA-INTEGRITY RULES (do not violate on re-seed):
--   * sqm is NULL where the approved-plan area is ILLEGIBLE — never fabricate.
--     Lots with NULL sqm: 85, 89, 93, 94, 106, 107, 108, 113.
--   * area_confidence carries how trustworthy each area is:
--       'surveyed'  — Quantum feature survey (high): 88, 91, 112
--       'plan_ocr'  — OCR of the approved subdivision plan (show as "approx")
--       'narrative' — from purchaser MOM, NOT surveyed: 109 (~2,500 m²)
--       'illegible' — area unknown; sqm NULL; UI shows "area TBC"
--   * No lot has a street number (no titles yet). Address is SYNTHETIC, never a
--     geocoder output: "Lot {N}, Brownlie Street, Waggrakine WA 6530".
--   * x_pct / y_pct are plan-relative marker positions over the lot-layout PNG.
--     They are SEEDED NULL — positions must be set by a human (admin click-to-
--     place) or by polygon extraction; we do not guess them here.
--
-- Idempotent: safe to re-run. Re-seed via the ON CONFLICT upsert at the bottom.

CREATE TABLE IF NOT EXISTS wavecrest_lot_allocations (
  lot_number       INTEGER PRIMARY KEY,
  sqm              INTEGER CHECK (sqm IS NULL OR sqm > 0),   -- NULL = illegible/TBC
  area_confidence  TEXT CHECK (
                     area_confidence IS NULL OR
                     area_confidence IN ('surveyed','plan_ocr','narrative','illegible')
                   ),
  status           TEXT NOT NULL DEFAULT 'available' CHECK (
                     status IN ('available','under_contract','sold','reserve')
                   ),
  zone             TEXT,                 -- e.g. 'POS' (public open space), 'homestead'
  public_label     TEXT,                 -- what the public map shows (e.g. "Lot 91")
  dwelling_type    TEXT,                 -- e.g. 'Koala70' for an under-contract H&L
  allocated_to     TEXT,
  stage            TEXT,                 -- internal only — staging terminology unreconciled
  x_pct            NUMERIC(5,2),         -- plan-relative marker X (set by admin; NULL = unplaced)
  y_pct            NUMERIC(5,2),         -- plan-relative marker Y
  address          TEXT,                 -- synthetic: "Lot N, Brownlie Street, Waggrakine WA 6530"
  land_only        NUMERIC(12,2) CHECK (land_only IS NULL OR land_only >= 0),
  house_cost       NUMERIC(12,2) CHECK (house_cost IS NULL OR house_cost >= 0),
  wholesale_price  NUMERIC(12,2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
  retail_price     NUMERIC(12,2) CHECK (retail_price IS NULL OR retail_price >= 0),
  display_price_to_public BOOLEAN NOT NULL DEFAULT FALSE,
  subdivisible            BOOLEAN,
  ancillary_dwelling_eligible BOOLEAN,
  notes            TEXT,
  assigned_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wavecrest_allocations_status
  ON wavecrest_lot_allocations (status);
CREATE INDEX IF NOT EXISTS idx_wavecrest_allocations_allocated_to
  ON wavecrest_lot_allocations (allocated_to)
  WHERE allocated_to IS NOT NULL;

-- updated_at trigger (mirror seafields)
CREATE OR REPLACE FUNCTION update_wavecrest_lot_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wavecrest_lot_allocations_updated_at
  ON wavecrest_lot_allocations;
CREATE TRIGGER trg_wavecrest_lot_allocations_updated_at
  BEFORE UPDATE ON wavecrest_lot_allocations
  FOR EACH ROW EXECUTE FUNCTION update_wavecrest_lot_allocations_updated_at();

ALTER TABLE wavecrest_lot_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_wavecrest_allocations" ON wavecrest_lot_allocations;
CREATE POLICY "public_read_wavecrest_allocations"
  ON wavecrest_lot_allocations
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "service_role_all_wavecrest_allocations" ON wavecrest_lot_allocations;
CREATE POLICY "service_role_all_wavecrest_allocations"
  ON wavecrest_lot_allocations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =====================================================================
-- SEED (from docs/wavecrest-lot-schedule.DRAFT.csv)
-- Illegible areas → sqm NULL + area_confidence 'illegible'.
-- ON CONFLICT updates the data columns but PRESERVES admin-set x_pct/y_pct
-- (positions are filled in the admin map, not by this seed).
-- =====================================================================
INSERT INTO wavecrest_lot_allocations
  (lot_number, sqm, area_confidence, status, zone, public_label, dwelling_type,
   retail_price, land_only, address, notes)
VALUES
  (83,  4550, 'plan_ocr',  'available',      'homestead', 'Homestead Lot', NULL, NULL,   NULL,   'Lot 83, Minchin Chase, Waggrakine WA 6530',     'AREA UNCONFIRMED (plan OCR ~4550). Homestead Lot, Minchin Chase frontage, Water Corp easement. Source: approved plan 1lS2mhN3.'),
  (85,  NULL, 'illegible', 'sold',           NULL,        'Lot 85',        NULL, NULL,   NULL,   'Lot 85, Brownlie Street, Waggrakine WA 6530',   'AREA ILLEGIBLE. 18m Reserve adjacent. Source: approved plan 1lS2mhN3.'),
  (86,  1500, 'plan_ocr',  'sold',           NULL,        'Lot 86',        NULL, NULL,   NULL,   'Lot 86, Brownlie Street, Waggrakine WA 6530',   'AREA UNCONFIRMED (plan OCR ~1500). Source: approved plan 1lS2mhN3.'),
  (87,  2532, 'plan_ocr',  'available',      NULL,        'Lot 87',        NULL, NULL,   NULL,   'Lot 87, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Fronts Brownlie Street. Source: approved plan 1lS2mhN3.'),
  (88,  2250, 'surveyed',  'available',      NULL,        'Lot 88',        NULL, NULL,   280000, 'Lot 88, Brownlie Street, Waggrakine WA 6530',   'AREA SURVEYED (high confidence). Fronts Brownlie Street. Land ~$280k (PF strategy). Sources: Quantum survey 1CPgXUztQ; land price 1IW3UBrk.'),
  (89,  NULL, 'illegible', 'sold',           NULL,        'Lot 89',        NULL, NULL,   NULL,   'Lot 89, Brownlie Street, Waggrakine WA 6530',   'AREA ILLEGIBLE. Source: approved plan 1lS2mhN3.'),
  (90,  2250, 'plan_ocr',  'available',      NULL,        'Lot 90',        NULL, NULL,   NULL,   'Lot 90, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (91,  2148, 'surveyed',  'under_contract', NULL,        'Lot 91',        NULL, NULL,   250000, 'Lot 91, Brownlie Street, Waggrakine WA 6530',   'AREA SURVEYED (high confidence). Range/ocean views; adjacent Lot 92. Land ~$250k. Display-home lot (Modular WA). Sources: Quantum survey 1-fItTNu; land 1IW3UBrk.'),
  (92,  2109, 'plan_ocr',  'available',      NULL,        'Lot 92',        NULL, NULL,   NULL,   'Lot 92, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (93,  NULL, 'illegible', 'available',      NULL,        'Lot 93',        NULL, NULL,   NULL,   'Lot 93, Brownlie Street, Waggrakine WA 6530',   'AREA ILLEGIBLE (~214x). Source: approved plan 1lS2mhN3.'),
  (94,  NULL, 'illegible', 'available',      NULL,        'Lot 94',        NULL, NULL,   NULL,   'Lot 94, Brownlie Street, Waggrakine WA 6530',   'AREA ILLEGIBLE (~210x). Source: approved plan 1lS2mhN3.'),
  (95,  2447, 'plan_ocr',  'available',      NULL,        'Lot 95',        NULL, NULL,   NULL,   'Lot 95, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (96,  2250, 'plan_ocr',  'available',      NULL,        'Lot 96',        NULL, NULL,   NULL,   'Lot 96, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (97,  2250, 'plan_ocr',  'available',      NULL,        'Lot 97',        NULL, NULL,   NULL,   'Lot 97, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. FUTURE SUBDIVISION zone nearby. Source: approved plan 1lS2mhN3.'),
  (98,  2250, 'plan_ocr',  'available',      NULL,        'Lot 98',        NULL, NULL,   NULL,   'Lot 98, Brownlie Street, Waggrakine WA 6530',   'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (99,  2250, 'plan_ocr',  'available',      NULL,        'Lot 99',        NULL, NULL,   NULL,   'Lot 99, Brownlie Street, Waggrakine WA 6530',   'AREA UNCONFIRMED (plan OCR ~2250). Source: approved plan 1lS2mhN3.'),
  (100, 2032, 'plan_ocr',  'available',      NULL,        'Lot 100',       NULL, NULL,   NULL,   'Lot 100, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (101, 2000, 'plan_ocr',  'available',      NULL,        'Lot 101',       NULL, NULL,   NULL,   'Lot 101, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (102, 2032, 'plan_ocr',  'available',      NULL,        'Lot 102',       NULL, NULL,   NULL,   'Lot 102, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR (grouped row). Source: approved plan 1lS2mhN3.'),
  (103, 2000, 'plan_ocr',  'available',      NULL,        'Lot 103',       NULL, NULL,   NULL,   'Lot 103, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR (grouped row). Source: approved plan 1lS2mhN3.'),
  (104, 2000, 'plan_ocr',  'available',      NULL,        'Lot 104',       NULL, NULL,   NULL,   'Lot 104, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR (grouped row). Source: approved plan 1lS2mhN3.'),
  (105, 2012, 'plan_ocr',  'available',      NULL,        'Lot 105',       NULL, NULL,   NULL,   'Lot 105, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR (grouped row). Source: approved plan 1lS2mhN3.'),
  (106, NULL, 'illegible', 'available',      NULL,        'Lot 106',       NULL, NULL,   NULL,   'Lot 106, Brownlie Street, Waggrakine WA 6530',  'AREA ILLEGIBLE. Source: approved plan 1lS2mhN3.'),
  (107, NULL, 'illegible', 'available',      NULL,        'Lot 107',       NULL, NULL,   NULL,   'Lot 107, Brownlie Street, Waggrakine WA 6530',  'AREA ILLEGIBLE. Source: approved plan 1lS2mhN3.'),
  (108, NULL, 'illegible', 'available',      NULL,        'Lot 108',       NULL, NULL,   NULL,   'Lot 108, Brownlie Street, Waggrakine WA 6530',  'AREA ILLEGIBLE. Source: approved plan 1lS2mhN3.'),
  (109, 2500, 'narrative', 'under_contract', NULL,        'Lot 109',       'Koala70', 327700, NULL, 'Lot 109, Brownlie Street, Waggrakine WA 6530', 'AREA from purchaser MOM (~2,500 m2 — NOT surveyed; no Quantum survey for 109). Under contract to Jacob & Annabelle Peers. Koala70 turnkey retail $327,700. 18m Reserve adjacent. Sources: MOM 1UVuDX6y; email 1FeSNK2N; plan 1lS2mhN3.'),
  (110, 2380, 'plan_ocr',  'sold',           NULL,        'Lot 110',       NULL, NULL,   NULL,   'Lot 110, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (111, 2250, 'plan_ocr',  'available',      NULL,        'Lot 111',       NULL, NULL,   NULL,   'Lot 111, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR. Adjacent Lot 112. Source: approved plan 1lS2mhN3.'),
  (112, 3013, 'surveyed',  'sold',           NULL,        'Lot 112',       NULL, NULL,   250000, 'Lot 112, Brownlie Street, Waggrakine WA 6530',  'AREA SURVEYED (high confidence). Adjacent Lots 111/113. Land ~$250k. Sources: Quantum survey 1BXBW__Q; land 1IW3UBrk.'),
  (113, NULL, 'illegible', 'available',      NULL,        'Lot 113',       NULL, NULL,   NULL,   'Lot 113, Brownlie Street, Waggrakine WA 6530',  'AREA ILLEGIBLE (~22xx). Source: approved plan 1lS2mhN3.'),
  (114, 2252, 'plan_ocr',  'sold',           NULL,        'Lot 114',       NULL, NULL,   NULL,   'Lot 114, Brownlie Street, Waggrakine WA 6530',  'Area plan-OCR. Source: approved plan 1lS2mhN3.'),
  (115, 7820, 'plan_ocr',  'reserve',        'POS',       'Public Open Space', NULL, NULL, NULL, 'Lot 115, Brownlie Street, Waggrakine WA 6530',  'NOT A SALEABLE LOT — Public Open Space reserve. Area plan-OCR. Source: approved plan 1lS2mhN3.')
ON CONFLICT (lot_number) DO UPDATE SET
  sqm             = EXCLUDED.sqm,
  area_confidence = EXCLUDED.area_confidence,
  status          = EXCLUDED.status,
  zone            = EXCLUDED.zone,
  public_label    = EXCLUDED.public_label,
  dwelling_type   = EXCLUDED.dwelling_type,
  retail_price    = EXCLUDED.retail_price,
  land_only       = EXCLUDED.land_only,
  address         = EXCLUDED.address,
  notes           = EXCLUDED.notes;
  -- NB: x_pct/y_pct deliberately NOT overwritten — preserve admin-set positions.

COMMENT ON TABLE wavecrest_lot_allocations IS
  'Authoritative lot register for Wavecrest Estate (Brownlie Street, Waggrakine WA 6530), lots 83–115. Area confidence preserved per row; illegible areas held NULL (never fabricated). x_pct/y_pct are admin-set plan-relative marker positions.';
