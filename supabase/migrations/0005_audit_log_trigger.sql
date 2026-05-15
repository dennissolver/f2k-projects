-- F2K-Projects — Seafields launch schema, part 4 of 5
-- Audit log enhancements: additive columns, immutability via RLS, and a
-- DB-level trigger that writes one audit row per changed field on every
-- mutation to lots, stages, and registration_lots.
--
-- Authored per /docs/migration-plan-0002.md §5 and §6.
-- Idempotent: safe to re-run.
-- Non-destructive: existing audit_log columns and rows untouched.
--
-- NOTE on app-level double-logging:
-- Existing admin API endpoints (src/app/api/admin/seafields/allocations/
-- [lotNumber]/route.ts) also write audit rows via the auditLog() helper.
-- After this migration applies, those writes coexist with trigger-written
-- rows — same change produces two audit_log entries (one with `action =
-- 'seafields_lot_allocation_updated'`, another with `action =
-- 'UPDATE_seafields_lot_allocations'`). Phase 4.3 removes the app-level
-- call when it adds the reason/actor session-variable plumbing.
--
-- Prereqs: 0002 (stages), 0003 (lot enums), 0004 (registration_lots)

-- =====================================================================
-- ADDITIVE COLUMNS ON audit_log
-- =====================================================================

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS field_changed TEXT,
  ADD COLUMN IF NOT EXISTS old_value     JSONB,
  ADD COLUMN IF NOT EXISTS new_value     JSONB,
  ADD COLUMN IF NOT EXISTS reason        TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_field
  ON audit_log (entity_type, field_changed)
  WHERE field_changed IS NOT NULL;

-- =====================================================================
-- IMMUTABILITY VIA RLS (INSERT + SELECT only; UPDATE/DELETE denied)
-- =====================================================================
--
-- Audit rows must not be retroactively edited or removed. We drop the
-- existing service_role_all_audit_log policy and replace it with
-- explicit INSERT + SELECT policies. UPDATE and DELETE are denied
-- because no policy permits them.
--
-- If you ever need to clean up a malformed audit row, you must ALTER
-- POLICY first — by design.

DROP POLICY IF EXISTS "service_role_all_audit_log" ON audit_log;

DROP POLICY IF EXISTS "service_role_insert_audit_log" ON audit_log;
CREATE POLICY "service_role_insert_audit_log"
  ON audit_log FOR INSERT TO service_role
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "service_role_select_audit_log" ON audit_log;
CREATE POLICY "service_role_select_audit_log"
  ON audit_log FOR SELECT TO service_role
  USING (TRUE);

-- =====================================================================
-- AUDIT TRIGGER FUNCTION
-- =====================================================================
-- Generic: works on any table with either a UUID id or an INTEGER
-- lot_number primary key. Reads actor + reason from session-local
-- variables that the admin API sets before each UPDATE/INSERT/DELETE:
--
--   SET LOCAL app.actor_id    = '<admin uuid>';
--   SET LOCAL app.actor_email = '<admin email>';
--   SET LOCAL app.audit_reason = '<reason text or NULL>';
--
-- For UPDATEs, emits one audit_log row per changed field. Skips the
-- housekeeping column `updated_at`.
--
-- SECURITY DEFINER so the trigger can INSERT into audit_log even when
-- the calling role doesn't have direct INSERT on audit_log. search_path
-- is pinned to prevent shadowing attacks.

CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id    UUID;
  v_actor_email TEXT;
  v_reason      TEXT;
  v_entity_id   UUID := NULL;
  v_lot_number  INTEGER := NULL;
  v_old_json    JSONB;
  v_new_json    JSONB;
  v_key         TEXT;
  v_details     JSONB := '{}'::jsonb;
BEGIN
  -- Read session context (NULL if not set — safe for unattended writes)
  BEGIN
    v_actor_id := NULLIF(current_setting('app.actor_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;
  v_actor_email := NULLIF(current_setting('app.actor_email', TRUE), '');
  v_reason      := NULLIF(current_setting('app.audit_reason', TRUE), '');

  -- Entity-key extraction depends on the table.
  IF TG_TABLE_NAME = 'seafields_lot_allocations' THEN
    -- lots use INTEGER lot_number, not UUID; record in details
    IF TG_OP = 'DELETE' THEN
      v_lot_number := OLD.lot_number;
    ELSE
      v_lot_number := NEW.lot_number;
    END IF;
    v_details := jsonb_build_object('lot_number', v_lot_number);
  ELSIF TG_TABLE_NAME = 'stages' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id;
    ELSE
      v_entity_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'seafields_registration_lots' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id;
      v_details := jsonb_build_object(
        'registration_id', OLD.registration_id,
        'lot_number',      OLD.lot_number
      );
    ELSE
      v_entity_id := NEW.id;
      v_details := jsonb_build_object(
        'registration_id', NEW.registration_id,
        'lot_number',      NEW.lot_number
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    FOR v_key IN SELECT jsonb_object_keys(v_old_json) LOOP
      -- skip housekeeping
      IF v_key IN ('updated_at') THEN
        CONTINUE;
      END IF;

      IF (v_old_json -> v_key) IS DISTINCT FROM (v_new_json -> v_key) THEN
        INSERT INTO audit_log (
          actor_id, actor_email, action, entity_type, entity_id,
          field_changed, old_value, new_value, reason, details
        ) VALUES (
          v_actor_id,
          COALESCE(v_actor_email, 'system'),
          'UPDATE_' || TG_TABLE_NAME,
          TG_TABLE_NAME,
          v_entity_id,
          v_key,
          v_old_json -> v_key,
          v_new_json -> v_key,
          v_reason,
          v_details
        );
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
      actor_id, actor_email, action, entity_type, entity_id,
      new_value, reason, details
    ) VALUES (
      v_actor_id,
      COALESCE(v_actor_email, 'system'),
      'INSERT_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      v_entity_id,
      to_jsonb(NEW),
      v_reason,
      v_details
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
      actor_id, actor_email, action, entity_type, entity_id,
      old_value, reason, details
    ) VALUES (
      v_actor_id,
      COALESCE(v_actor_email, 'system'),
      'DELETE_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      v_entity_id,
      to_jsonb(OLD),
      v_reason,
      v_details
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

DROP TRIGGER IF EXISTS trg_audit_lots ON seafields_lot_allocations;
CREATE TRIGGER trg_audit_lots
  AFTER INSERT OR UPDATE OR DELETE ON seafields_lot_allocations
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

DROP TRIGGER IF EXISTS trg_audit_stages ON stages;
CREATE TRIGGER trg_audit_stages
  AFTER INSERT OR UPDATE OR DELETE ON stages
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

DROP TRIGGER IF EXISTS trg_audit_srl ON seafields_registration_lots;
CREATE TRIGGER trg_audit_srl
  AFTER INSERT OR UPDATE OR DELETE ON seafields_registration_lots
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

COMMENT ON FUNCTION audit_entity_change IS
  'Generic AFTER-trigger function that writes one audit_log row per changed field on UPDATE, or one row per INSERT/DELETE. Reads actor (app.actor_id, app.actor_email) and reason (app.audit_reason) from session variables. SECURITY DEFINER with pinned search_path.';
