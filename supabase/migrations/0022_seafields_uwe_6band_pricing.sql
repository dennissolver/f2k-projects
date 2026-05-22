-- 0021_seafields_uwe_6band_pricing.sql
--
-- Replaces migration 0020's 4-band scheme with Uwe's 6-band scale plus
-- a special price for Lot 323 (the 1522m² heritage lot at Stage 2).
-- Email from Uwe 2026-05-23 01:58 AEDT.
--
-- Net effect vs 0020: Compact band extended from ≤520 to ≤550 (15 extra
-- lots now $155k instead of $165k — this was Uwe's flagged bug). Other
-- bands re-priced cheaper across the board.
--
--   Band                  Range             Price       Lots
--   -------------------   ---------------   ---------   ----
--   A  Compact            ≤550m²            $155,000      30
--   B  Standard           551–600m²         $160,000      52
--   C  Family             601–750m²         $165,000      50
--   D  Premium            751–800m²         $175,000       5
--   E  Premium plus       801–850m²         $180,000       5 (1 heritage skipped)
--   F  Estate             851–900m²         $190,000       0 (empty band, no lots)
--   G  POA                >900m²            NULL          1 (Lot 323 — handled below)
--   *  Lot 323 special    1522m² heritage   $270,000       1
--
-- Excluded from band updates:
--   - allocation_bucket = 'heritage_retained'  (Lot 323 handled separately below)
--   - status = 'sold'                          (price locked at sale time)

BEGIN;

-- Step 1: Apply the 6-band update to all non-heritage, non-sold lots.
WITH band_updates AS (
  UPDATE seafields_lot_allocations
  SET
    retail_price = CASE
      WHEN sqm <= 550 THEN 155000
      WHEN sqm <= 600 THEN 160000
      WHEN sqm <= 750 THEN 165000
      WHEN sqm <= 800 THEN 175000
      WHEN sqm <= 850 THEN 180000
      WHEN sqm <= 900 THEN 190000
      ELSE NULL  -- POA for anything >900m² that ISN'T Lot 323
    END,
    updated_at = NOW()
  WHERE
    sqm IS NOT NULL
    AND (allocation_bucket IS DISTINCT FROM 'heritage_retained')
    AND (status IS DISTINCT FROM 'sold')
  RETURNING lot_number, retail_price
),
band_audit AS (
  INSERT INTO audit_log (
    actor_id, actor_email, action, entity_type, entity_id, details
  )
  SELECT
    NULL,
    'system@bulk-pricing',
    'seafields_uwe_6band_prices_applied',
    'seafields_lot_allocations',
    NULL,
    jsonb_build_object(
      'source', 'migration 0021',
      'authority', 'Uwe email 2026-05-23 01:58 AEDT — replaces 0020',
      'bands', jsonb_build_object(
        'a_compact_to_550_m2', 155000,
        'b_standard_551_to_600_m2', 160000,
        'c_family_601_to_750_m2', 165000,
        'd_premium_751_to_800_m2', 175000,
        'e_premium_plus_801_to_850_m2', 180000,
        'f_estate_851_to_900_m2', 190000,
        'g_poa_over_900_m2_excl_lot_323', NULL
      ),
      'special_lot_323_price', 270000,
      'exclusions', jsonb_build_array('heritage_retained (except lot 323)', 'sold'),
      'rows_updated_by_bands', (SELECT COUNT(*) FROM band_updates)
    )
  RETURNING 1
)
SELECT 1;  -- final select required by the CTE chain

-- Step 2: Lot 323 (heritage, 1522m², Stage 2) gets a hand-set $270k per
-- Uwe. Status / allocation_bucket left unchanged — Uwe to confirm on
-- the 1pm AEDT call whether to flip status from 'withheld' to 'available'
-- and whether to drop the heritage_retained bucket. Pricing alone does
-- NOT make the lot publicly visible; that decision is gated on those
-- flags.
UPDATE seafields_lot_allocations
SET
  retail_price = 270000,
  updated_at = NOW(),
  notes = COALESCE(notes || E'\n', '') ||
    '2026-05-23: retail price set to $270k per Uwe (Property Friends email 01:58 AEDT). Status + heritage tag unchanged pending phone-call confirmation.'
WHERE lot_number = 323;

INSERT INTO audit_log (actor_email, action, entity_type, details)
VALUES (
  'system@bulk-pricing',
  'seafields_lot_323_special_price',
  'seafields_lot_allocations',
  jsonb_build_object(
    'lot_number', 323,
    'retail_price', 270000,
    'status_unchanged', 'withheld',
    'bucket_unchanged', 'heritage_retained',
    'authority', 'Uwe email 2026-05-23 01:58 AEDT',
    'follow_up', 'Confirm status + heritage flag with Uwe on 1pm AEDT call'
  )
);

COMMIT;
