-- F2K-Projects — Seafields launch schema, part 5 of 5
-- Public-facing views: seafields_public_lots (anon-safe lot data with
-- computed pricing) + stages_with_escalation (rate ladder + computed
-- escalation %).
--
-- Authored per /docs/migration-plan-0002.md §3.7 and §1 (Option A).
-- Idempotent: CREATE OR REPLACE VIEW.
-- Non-destructive: existing anon SELECT policy on
-- seafields_lot_allocations is KEPT for now per option (b) "phased" —
-- monitor Supabase logs for any external consumer hitting the base
-- table directly. After a 7-day clean window, schedule a 0007_*.sql
-- micro-migration to DROP that policy and force anon through the view.
--
-- Prereqs: 0002 (stages), 0003 (lot columns)

-- =====================================================================
-- VIEW: stages_with_escalation
-- =====================================================================
-- Computed escalation_pct = % above Stage 1's rate_per_sqm.
-- NULL when rate is unset for either this stage or Stage 1.
-- Per migration plan §12.4 option (A): computed only, no stored column.

CREATE OR REPLACE VIEW stages_with_escalation AS
SELECT
  s.id,
  s.stage_number,
  s.stage_label,
  s.rate_per_sqm,
  s.is_open_for_registration,
  s.auto_advance_threshold_pct,
  s.public_visible,
  s.created_at,
  s.updated_at,
  CASE
    WHEN s1.rate_per_sqm IS NULL OR s1.rate_per_sqm = 0 THEN NULL
    WHEN s.rate_per_sqm  IS NULL                        THEN NULL
    ELSE ROUND((s.rate_per_sqm / s1.rate_per_sqm - 1) * 100, 2)
  END AS escalation_pct
FROM stages s
LEFT JOIN stages s1 ON s1.stage_number = 1;

GRANT SELECT ON stages_with_escalation TO anon, authenticated;

COMMENT ON VIEW stages_with_escalation IS
  'Stages with computed escalation_pct (% above Stage 1 rate). Admin/public read this; admin writes only stages.rate_per_sqm. Single source of truth.';

-- =====================================================================
-- VIEW: seafields_public_lots
-- =====================================================================
-- Anon-safe projection of seafields_lot_allocations + joined stage data.
-- Hides admin-only columns (wholesale_price, retail_price, notes,
-- intent_locked_*, assigned_by). Suppresses prices when
-- display_price_to_public = FALSE OR stage.public_visible = FALSE.
-- Filters out lots whose stage is not public_visible.
--
-- Computed columns:
--   effective_rate_per_sqm = COALESCE(land_rate_override, stage_rate)
--   land_total             = sqm * effective_rate_per_sqm
--   total_price            = land_total + COALESCE(house_cost, 0)
--
-- Per migration plan §3.7 — the anon SELECT policy on the base table
-- stays in place for now (option b "phased"). External consumers
-- continue to read the base table; new public API code should read
-- this view going forward.

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
  -- Effective $/m²: per-lot override wins over stage rate.
  -- NULL when display is suppressed at either the lot or stage level.
  CASE WHEN sla.display_price_to_public AND COALESCE(s.public_visible, TRUE)
       THEN COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
       ELSE NULL
  END AS effective_rate_per_sqm,
  -- Land total = area × effective rate.
  CASE WHEN sla.display_price_to_public AND COALESCE(s.public_visible, TRUE)
       THEN sla.sqm * COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
       ELSE NULL
  END AS land_total,
  -- Total price = land_total + house_cost (for H&L packages).
  CASE WHEN sla.display_price_to_public AND COALESCE(s.public_visible, TRUE)
       THEN sla.sqm * COALESCE(sla.land_rate_override_per_sqm, s.rate_per_sqm)
          + COALESCE(sla.house_cost, 0)
       ELSE NULL
  END AS total_price,
  -- Land-only flag is purely informational at the public layer; doesn't
  -- gate display.
  sla.land_only
FROM seafields_lot_allocations sla
LEFT JOIN stages s ON s.id = sla.stage_id
WHERE COALESCE(s.public_visible, TRUE) = TRUE;

GRANT SELECT ON seafields_public_lots TO anon, authenticated;

COMMENT ON VIEW seafields_public_lots IS
  'Public-safe projection of Seafields lot data. Hides wholesale/retail prices, internal notes, intent-lock metadata. Suppresses prices when display_price_to_public=FALSE or stages.public_visible=FALSE. Replaces direct anon access on seafields_lot_allocations once the existing anon SELECT policy is dropped (scheduled for migration 0007 after monitoring window).';
