-- 0040_agent_registrations_view.sql
--
-- Workstream 1: Agent live grid + export
-- - Adds ownership enum to track unassigned/house/agent states
-- - Creates agent_registrations_view joining registrations → allocation → lot/stage
-- - Enables server-side scoped reads for the grid/export
--
-- Authored per f2k-projects-agent-portal-build-directive-30052026.md

BEGIN;

-- 1. Ownership enum — three states per Dennis's decision
DO $$ BEGIN
  CREATE TYPE ownership_state AS ENUM ('unassigned', 'house', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add ownership column to both registration tables
ALTER TABLE public.seafields_registrations
  ADD COLUMN IF NOT EXISTS ownership ownership_state DEFAULT 'unassigned';

ALTER TABLE public.branscombe_registrations
  ADD COLUMN IF NOT EXISTS ownership ownership_state DEFAULT 'unassigned';

-- 3. Backfill: rows with agent_id = 'agent', else 'unassigned'
UPDATE public.seafields_registrations
SET ownership = 'agent'
WHERE agent_id IS NOT NULL
  AND ownership IS DISTINCT FROM 'agent';

UPDATE public.branscombe_registrations
SET ownership = 'agent'
WHERE agent_id IS NOT NULL
  AND ownership IS DISTINCT FROM 'agent';

-- 4. Index for quick ownership filtering
CREATE INDEX IF NOT EXISTS idx_seafields_regs_ownership ON public.seafields_registrations(ownership);
CREATE INDEX IF NOT EXISTS idx_branscombe_regs_ownership ON public.branscombe_registrations(ownership);

-- 5. View: agent_registrations_view — one row per registration, with stage and lot status
-- One row per registration (not per lot), lots collapsed into array
DROP VIEW IF EXISTS agent_registrations_view;
CREATE VIEW agent_registrations_view AS
SELECT
  -- Core registration fields
  r.id AS registration_id,
  r.first_name,
  r.last_name,
  r.email,
  r.phone,
  r.buyer_type,
  r.purchase_timeline,
  r.created_at,
  r.agent_id,
  r.ownership,
  r.source AS registration_source,

  -- Estate identifier
  'seafields' AS estate,

  -- Lots of interest (array)
  r.lots_selected,

  -- Stage at registration (from most recent registration_lots row)
  (
    SELECT s.name
    FROM seafields_registration_lots srl
    JOIN stages s ON s.id = srl.stage_at_registration_id
    WHERE srl.registration_id = r.id
    ORDER BY srl.created_at DESC
    LIMIT 1
  ) AS stage_name,

  -- Lead status: most recent status across all lots (active/locked_in/cancelled/etc)
  (
    SELECT srl.status
    FROM seafields_registration_lots srl
    WHERE srl.registration_id = r.id
    ORDER BY
      CASE srl.status
        WHEN 'active' THEN 1
        WHEN 'locked_in' THEN 2
        WHEN 'converted_to_sale' THEN 3
        WHEN 'released' THEN 4
        WHEN 'cancelled' THEN 5
        ELSE 6
      END
    LIMIT 1
  ) AS lead_status,

  -- Lot statuses: array of {lot_number, status}
  (
    SELECT jsonb_agg(jsonb_build_object('lot', sla.lot_number, 'status', sla.status))
    FROM seafields_lot_allocations sla
    WHERE sla.lot_number = ANY(r.lots_selected)
  ) AS lot_statuses,

  -- Link to agent record (if ownership = 'agent')
  a.name AS agent_name,
  a.agency AS agent_agency

FROM seafields_registrations r
LEFT JOIN agents a ON a.id = r.agent_id AND a.active = true

UNION ALL

SELECT
  -- Core registration fields
  r.id AS registration_id,
  r.first_name,
  r.last_name,
  r.email,
  r.phone,
  r.buyer_type,
  r.purchase_timeline,
  r.created_at,
  r.agent_id,
  r.ownership,
  r.source AS registration_source,

  -- Estate identifier
  'branscombe' AS estate,

  -- Units of interest (array)
  r.units_selected,

  -- Stage: Branscombe doesn't have stages, null
  NULL AS stage_name,

  -- Lead status: from unit allocations
  (
    SELECT bua.status
    FROM branscombe_unit_allocations bua
    WHERE bua.registration_id = r.id
    ORDER BY
      CASE bua.status
        WHEN 'active' THEN 1
        WHEN 'reserved' THEN 2
        WHEN 'sold' THEN 3
        WHEN 'withdrawn' THEN 4
        ELSE 5
      END
    LIMIT 1
  ) AS lead_status,

  -- Unit statuses: array of {unit, status}
  (
    SELECT jsonb_agg(jsonb_build_object('lot', bua.unit_number, 'status', bua.status))
    FROM branscombe_unit_allocations bua
    WHERE bua.unit_number = ANY(r.units_selected)
  ) AS lot_statuses,

  -- Link to agent record
  a.name AS agent_name,
  a.agency AS agent_agency

FROM branscombe_registrations r
LEFT JOIN agents a ON a.id = r.agent_id AND a.active = true;

-- Grant read access to authenticated users (RLS on base tables protects)
GRANT SELECT ON agent_registrations_view TO authenticated;

-- 6. Function to get agent-scoped registrations (used by API)
-- Returns only registrations for a specific agent_id
DROP FUNCTION IF EXISTS get_agent_registrations(uuid);
CREATE OR REPLACE FUNCTION get_agent_registrations(p_agent_id uuid)
RETURNS TABLE (
  registration_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  buyer_type text,
  purchase_timeline text,
  created_at timestamptz,
  ownership ownership_state,
  estate text,
  lots_selected text[],
  stage_name text,
  lead_status text,
  lot_statuses jsonb,
  agent_name text,
  agent_agency text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.registration_id,
    v.first_name,
    v.last_name,
    v.email,
    v.phone,
    v.buyer_type,
    v.purchase_timeline,
    v.created_at,
    v.ownership,
    v.estate,
    v.lots_selected,
    v.stage_name,
    v.lead_status,
    v.lot_statuses,
    v.agent_name,
    v.agent_agency
  FROM agent_registrations_view v
  WHERE v.agent_id = p_agent_id
    AND v.ownership = 'agent'::ownership_state
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also allow viewing 'house' ownership for admin purposes
DROP FUNCTION IF EXISTS get_agent_registrations_with_house(uuid);
CREATE OR REPLACE FUNCTION get_agent_registrations_with_house(p_agent_id uuid)
RETURNS TABLE (
  registration_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  buyer_type text,
  purchase_timeline text,
  created_at timestamptz,
  ownership ownership_state,
  estate text,
  lots_selected text[],
  stage_name text,
  lead_status text,
  lot_statuses jsonb,
  agent_name text,
  agent_agency text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.registration_id,
    v.first_name,
    v.last_name,
    v.email,
    v.phone,
    v.buyer_type,
    v.purchase_timeline,
    v.created_at,
    v.ownership,
    v.estate,
    v.lots_selected,
    v.stage_name,
    v.lead_status,
    v.lot_statuses,
    v.agent_name,
    v.agent_agency
  FROM agent_registrations_view v
  WHERE v.agent_id = p_agent_id
    AND v.ownership IN ('agent'::ownership_state, 'house'::ownership_state)
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for unassigned registrations (for admin triage queue)
DROP VIEW IF EXISTS unassigned_registrations_view;
CREATE VIEW unassigned_registrations_view AS
SELECT
  registration_id,
  first_name,
  last_name,
  email,
  phone,
  buyer_type,
  purchase_timeline,
  created_at,
  ownership,
  estate,
  lots_selected,
  stage_name,
  lead_status,
  lot_statuses,
  agent_name,
  agent_agency
FROM agent_registrations_view
WHERE ownership = 'unassigned'::ownership_state
ORDER BY created_at DESC;

GRANT SELECT ON unassigned_registrations_view TO authenticated;

COMMIT;
