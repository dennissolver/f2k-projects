-- F2K-Projects — Seafields launch schema, part 3 of 5
-- New seafields_registration_lots join table — hybrid registrations model.
-- One row per (registrant × lot) carrying queue and status state, while
-- seafields_registrations stays as the contact / profile row.
--
-- Authored per /docs/migration-plan-0002.md §4.
-- Idempotent: safe to re-run. Back-fill is ON CONFLICT DO NOTHING.
-- Non-destructive: seafields_registrations.lots_selected text[] stays in
-- place — Phase 4.3 dual-writes to both; later phases switch reads to
-- this table.
--
-- Prereqs: 0002 (stages) + 0003 (lot status enum)

-- =====================================================================
-- TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS seafields_registration_lots (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id               UUID NOT NULL
    REFERENCES seafields_registrations(id) ON DELETE CASCADE,
  lot_number                    INTEGER NOT NULL
    REFERENCES seafields_lot_allocations(lot_number) ON DELETE RESTRICT,
  registration_type             TEXT NOT NULL DEFAULT 'primary'
    CHECK (registration_type IN ('primary', 'backup_list')),
  status                        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'locked_in', 'converted_to_sale', 'cancelled', 'released')),
  position_in_queue             INTEGER,
  stage_at_registration_id      UUID REFERENCES stages(id),
  notified_of_neighbour_at      TIMESTAMPTZ,
  notified_of_release_at        TIMESTAMPTZ,
  notified_of_stage_advance_at  TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
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

CREATE INDEX IF NOT EXISTS idx_srl_backup_list
  ON seafields_registration_lots (lot_number, position_in_queue)
  WHERE registration_type = 'backup_list' AND status = 'active';

-- =====================================================================
-- TRIGGERS
-- =====================================================================

DROP TRIGGER IF EXISTS trg_srl_updated_at ON seafields_registration_lots;
CREATE TRIGGER trg_srl_updated_at
  BEFORE UPDATE ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Position-in-queue assignment trigger.
-- Counts existing active/locked_in rows on the same lot of the same
-- registration_type and assigns next position. App code can pass an
-- explicit position_in_queue (used by back-fill below) and the trigger
-- skips assignment.
CREATE OR REPLACE FUNCTION set_srl_position_in_queue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position_in_queue IS NULL THEN
    SELECT COALESCE(MAX(position_in_queue), 0) + 1
      INTO NEW.position_in_queue
      FROM seafields_registration_lots
      WHERE lot_number = NEW.lot_number
        AND registration_type = NEW.registration_type
        AND status IN ('active', 'locked_in');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_srl_set_position ON seafields_registration_lots;
CREATE TRIGGER trg_srl_set_position
  BEFORE INSERT ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION set_srl_position_in_queue();

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE seafields_registration_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_srl" ON seafields_registration_lots;
CREATE POLICY "service_role_all_srl"
  ON seafields_registration_lots FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- No anon access. Heat counts continue to be served via the existing
-- /api/seafields/lots aggregation endpoint, which uses the service key.

-- =====================================================================
-- BACK-FILL: explode existing seafields_registrations.lots_selected[]
-- =====================================================================
-- One row per (registration × lot). position_in_queue is assigned by
-- registration.created_at order per lot. registration_type defaults to
-- 'primary' for back-filled rows (no backup-list semantics existed
-- pre-migration). stage_at_registration_id stays NULL for back-filled
-- rows — historical registrations pre-date stage gating.
--
-- ON CONFLICT DO NOTHING keeps re-runs idempotent.

INSERT INTO seafields_registration_lots (
  registration_id, lot_number, registration_type, status,
  position_in_queue, created_at
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
WHERE lot_id ~ '^L[0-9]+$'
  AND CAST(SUBSTRING(lot_id FROM 2) AS INTEGER) IN (
    SELECT lot_number FROM seafields_lot_allocations
  )
ON CONFLICT (registration_id, lot_number) DO NOTHING;

COMMENT ON TABLE seafields_registration_lots IS
  'One row per (Seafields registration × lot of interest). Carries position_in_queue, status, registration_type. Hybrid model with seafields_registrations.lots_selected[] kept as a denormalised cache for back-compat.';

COMMENT ON COLUMN seafields_registration_lots.registration_type IS
  '"primary" = registered on an Available lot. "backup_list" = registered on a Reserved lot, opt-in for release notification.';

COMMENT ON COLUMN seafields_registration_lots.stage_at_registration_id IS
  'Stage the lot was in when the registrant submitted. Used for price-protection notifications when the stage auto-advances. NULL for rows back-filled from pre-migration data.';
