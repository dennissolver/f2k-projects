-- 0063_roi_portal_attribution.sql
--
-- Phase 1 of the agent ROI portal (spec: docs/Branscombe_ROI_Portal_Form_BuildSpec_v2.1.md §4).
-- Tokenised, first-touch-immutable attribution. Builds on the agents.attribution_token
-- column that 0062 added.
--
-- This migration:
--   1. Creates the `agencies` table that 0062 deferred (introducing_agency_id was a plain
--      nullable UUID; it now FKs here) + agents.agency_id.
--   2. Enforces FIRST-TOUCH IMMUTABILITY: once introducing_agent_id / introducing_agency_id /
--      first_touch_at are set on a registration row they cannot be changed. A NULL->value
--      first touch is allowed; value->different is blocked unless an admin override header
--      is present (x-allow-attribution-override: true), and every override is written to
--      audit_log. This is the system's role per spec §4 — "evidence first-touch".
--
-- All tables stay service-role writes only (RLS deny-by-default, post-0027 pattern).
-- Idempotent + non-destructive.

BEGIN;

-- ============================================================================
-- agencies  (the introducing agency; carries co-brand identity used in Phase 9)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  logo_url    TEXT,                                   -- co-brand logo (F2K-approved before activation)
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.agencies IS
  'Introducing agency identity for the agent ROI portal (spec §4/§9). Service-role writes only.';

-- Link agents to an agency (nullable — existing agents use the free-text agents.agency column;
-- this is the normalised path going forward). No backfill required.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS agents_agency_id_idx ON public.agents (agency_id);

-- Promote the 0062 introducing_agency_id columns from plain UUID to real FKs now that the
-- target table exists. No rows exist yet (Phase 0 created the tables empty), so this is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_registrations_agency_fk'
  ) THEN
    ALTER TABLE public.waitlist_registrations
      ADD CONSTRAINT waitlist_registrations_agency_fk
      FOREIGN KEY (introducing_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registrations_agency_fk'
  ) THEN
    ALTER TABLE public.registrations
      ADD CONSTRAINT registrations_agency_fk
      FOREIGN KEY (introducing_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ============================================================================
-- First-touch immutability trigger
-- ============================================================================
-- Protects the attribution fields on both registration artefacts. Once a field is set
-- (non-NULL), it cannot be changed to a different value. NULL -> value (the first touch,
-- and the admin assigning an unassigned-pool lead) is always allowed. A change of an
-- already-set value is blocked UNLESS the caller presents an override:
--   - PostgREST header  x-allow-attribution-override: true   (admin reassign API, Phase 4), or
--   - session var       app.allow_attribution_override = 'true'  (psql / scripts).
-- Every permitted override writes an audit_log row (action = 'attribution_override') so a
-- reassignment is never silent — even if a future API forgets to log it itself. Actor/reason
-- come from the same x-actor-email / x-audit-reason headers the audit trigger uses (migration 0008).

CREATE OR REPLACE FUNCTION enforce_attribution_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_protected   TEXT[] := ARRAY['introducing_agent_id', 'introducing_agency_id', 'first_touch_at'];
  v_key         TEXT;
  v_old         JSONB := to_jsonb(OLD);
  v_new         JSONB := to_jsonb(NEW);
  v_override    BOOLEAN := FALSE;
  v_headers     JSONB;
  v_actor_email TEXT;
  v_reason      TEXT;
BEGIN
  -- Resolve override flag: session var first (psql/scripts), then request header (API).
  BEGIN
    v_override := COALESCE(NULLIF(current_setting('app.allow_attribution_override', TRUE), ''), 'false')::BOOLEAN;
  EXCEPTION WHEN OTHERS THEN
    v_override := FALSE;
  END;

  BEGIN
    v_headers := current_setting('request.headers', TRUE)::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  IF v_headers IS NOT NULL THEN
    IF lower(COALESCE(v_headers->>'x-allow-attribution-override', '')) = 'true' THEN
      v_override := TRUE;
    END IF;
    v_actor_email := NULLIF(v_headers->>'x-actor-email', '');
    v_reason      := NULLIF(v_headers->>'x-audit-reason', '');
  END IF;
  v_actor_email := COALESCE(v_actor_email, NULLIF(current_setting('app.actor_email', TRUE), ''));
  v_reason      := COALESCE(v_reason, NULLIF(current_setting('app.audit_reason', TRUE), ''));

  FOREACH v_key IN ARRAY v_protected LOOP
    -- Only fields the table actually has, that were already set, and are now being changed.
    IF v_old ? v_key
       AND (v_old ->> v_key) IS NOT NULL
       AND (v_old ->> v_key) IS DISTINCT FROM (v_new ->> v_key) THEN
      IF NOT v_override THEN
        RAISE EXCEPTION
          'Attribution is first-touch immutable: % cannot be changed once set (row %). Admin override required.',
          v_key, OLD.id
          USING ERRCODE = 'check_violation';
      END IF;
      -- Override permitted — record it.
      INSERT INTO audit_log (
        actor_id, actor_email, action, entity_type, entity_id,
        field_changed, old_value, new_value, reason, details
      ) VALUES (
        NULL,
        COALESCE(v_actor_email, 'system'),
        'attribution_override',
        TG_TABLE_NAME,
        NEW.id,
        v_key,
        v_old -> v_key,
        v_new -> v_key,
        v_reason,
        jsonb_build_object('table', TG_TABLE_NAME)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION enforce_attribution_immutability IS
  'BEFORE UPDATE guard for the ROI portal registration tables. Blocks changes to introducing_agent_id / introducing_agency_id / first_touch_at once set (first-touch wins, spec §4). NULL->value allowed. A change is permitted only with an x-allow-attribution-override:true header (or app.allow_attribution_override session var) and is logged to audit_log as attribution_override.';

DROP TRIGGER IF EXISTS trg_attribution_immutable_waitlist ON public.waitlist_registrations;
CREATE TRIGGER trg_attribution_immutable_waitlist
  BEFORE UPDATE ON public.waitlist_registrations
  FOR EACH ROW EXECUTE FUNCTION enforce_attribution_immutability();

DROP TRIGGER IF EXISTS trg_attribution_immutable_registrations ON public.registrations;
CREATE TRIGGER trg_attribution_immutable_registrations
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION enforce_attribution_immutability();

COMMIT;
