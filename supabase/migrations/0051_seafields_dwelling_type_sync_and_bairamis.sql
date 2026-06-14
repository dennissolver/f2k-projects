-- 0051_seafields_dwelling_type_sync_and_bairamis.sql
--
-- Two fixes from Uwe's 2026-06-14 reconciliation pass:
--
-- 1. Dwelling "Type" not updating in the admin lots list (issues 1 & 5).
--    The admin lots list reads the legacy free-text `dwelling_type` column,
--    but the edit modal only writes the FK `dwelling_type_id`. The two had
--    drifted: e.g. lot 236 showed "2x2BR" while its FK pointed at 4BR-MOD,
--    lot 238 showed "2x2BR" while its FK pointed at DUAL-OCC, and lot 237
--    showed "—" despite having a 3BR-STU-MOD FK. Going forward the PATCH route
--    keeps the legacy column in sync on every write; this backfills the
--    existing rows from the FK source of truth so the list is correct now.
--
-- 2. Spelling of the Bairamis counterparty (issue 2). The internal enum value
--    stays `baurimus` (it's embedded in CHECK constraints + back-fill matchers
--    and changing it would touch the live reserved lots 330/331); only the
--    operator-facing dwelling-type label is corrected here.

-- 1a. Sync legacy text from the FK where a dwelling type is set.
UPDATE seafields_lot_allocations la
SET dwelling_type = dt.code
FROM dwelling_types dt
WHERE la.dwelling_type_id = dt.id
  AND la.dwelling_type IS DISTINCT FROM dt.code;

-- 1b. Clear stale legacy text on lots with no dwelling-type FK (land-only /
--     unassigned). Without this an FK-cleared lot keeps its old "2x2BR" text.
UPDATE seafields_lot_allocations
SET dwelling_type = NULL
WHERE dwelling_type_id IS NULL
  AND dwelling_type IS NOT NULL;

-- 2. Correct the Bairamis dwelling-type spelling (was "Baurimus").
UPDATE dwelling_types
SET code = 'BAI-3B',
    plan_name = 'Bairamis 3-bed'
WHERE code = 'BAU-3B';
