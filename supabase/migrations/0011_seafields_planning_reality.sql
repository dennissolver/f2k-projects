-- Encode the R20 planning reality confirmed by Simon Burnell (CLE Town Planning)
-- on 2026-05-21 into the data model.
--
-- Key facts:
--   1. Subdivision into 2 saleable lots requires ≥ 900m² total. At Seafields
--      the only lot that qualifies is lot 323 (1522m², heritage retained) —
--      all other lots are deliberately sized < 900m² so they cannot be
--      further subdivided.
--   2. Dual occupancy via an ancillary dwelling (main house + ≤ 70m² ancillary)
--      is permitted on ANY lot, regardless of size, subject to R-Code
--      compliance on the build envelope. There is no lot-size threshold.
--   3. The existing dwelling_types row "DUAL-OCC / Dual Occupancy" was
--      misleading — it implied a traditional duplex (two equal dwellings),
--      which is not legally available on standard Seafields lots. Rename
--      to make the 70m² ancillary nature explicit.
--
-- Idempotent: safe to re-apply.

ALTER TABLE seafields_lot_allocations
  ADD COLUMN IF NOT EXISTS subdivisible
    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ancillary_dwelling_eligible
    BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill subdivisible. R20 + WAPC: ≥ 900m² is the minimum for further
-- subdivision into 2 lots. At Seafields this should match exactly one row
-- (lot 323 @ 1522m²). The UPDATE is data-driven so it stays correct if the
-- V6 polygon register changes later.
UPDATE seafields_lot_allocations
   SET subdivisible = TRUE
 WHERE sqm >= 900
   AND subdivisible = FALSE;

-- Rename the DUAL-OCC dwelling type so the meaning is unambiguous. We keep
-- the `code` stable (any FK or join in code still resolves) and only change
-- the user-facing labels + the plan_name field.
UPDATE dwelling_types
   SET plan_name     = 'Main Home + Ancillary Dwelling',
       display_label = 'Main Home + Ancillary Dwelling (≤70m² ancillary)',
       notes         = COALESCE(notes, '') ||
         E'\n\n[2026-05-21] Renamed from "Dual Occupancy" after CLE confirmed '
         'R20 rules: ancillary dwelling capped at 70m², permitted on any lot '
         'subject to R-Code build standards. Not a traditional duplex — '
         'standard Seafields lots cannot be subdivided into 2 saleable lots.'
 WHERE code = 'DUAL-OCC';

COMMENT ON COLUMN seafields_lot_allocations.subdivisible IS
  'TRUE only when lot area ≥ 900m² — the WAPC minimum for subdivision into 2 lots on this R20 plan. Per CLE 2026-05-21, only lot 323 (1522m² heritage) qualifies at Seafields. Read-only informational flag; not user-editable in the admin UI.';

COMMENT ON COLUMN seafields_lot_allocations.ancillary_dwelling_eligible IS
  'Defaults TRUE on every lot — CLE confirmed ancillary dwellings (capped 70m²) are permitted regardless of lot size, subject to R-Code build envelope. Mark FALSE only if an individual lot is provably non-viable for a main house + ancillary; admin UI does not yet expose this for edit.';
