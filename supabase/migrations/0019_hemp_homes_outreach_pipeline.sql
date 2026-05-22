-- 0018_hemp_homes_outreach_pipeline.sql
-- Prospect outreach foundation:
--   - outreach_templates: DB-stored, admin-editable templates with trigger
--     conditions, body markdown + LLM instruction
--   - prospect_outreach: per-send draft + send + delivery log (one row per
--     generation attempt; survives even if discarded)
--   - hemp_homes_community_prospects.outreach_status: pipeline lifecycle
--     that gates next sends (paused/declined never get re-targeted)

-- ============================================================================
-- TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hemp_homes_outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  -- Trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('stage_transition', 'time_gap', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Targeting predicates (any of: wave, status, state)
  target_waves INTEGER[] DEFAULT NULL, -- NULL = any wave
  target_statuses TEXT[] DEFAULT NULL, -- NULL = any status
  target_states TEXT[] DEFAULT NULL,
  -- Content (Liquid-style {{ variable }} substitution + LLM polish)
  subject_template TEXT NOT NULL,
  preview_template TEXT,
  body_md_template TEXT NOT NULL,
  llm_instruction TEXT, -- e.g. "Personalise based on the community's alt-build culture; keep under 250 words; warm but factual"
  -- Lifecycle
  active BOOLEAN NOT NULL DEFAULT true,
  auto_send BOOLEAN NOT NULL DEFAULT false, -- Phase 1 = false (always require approval)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_hemp_homes_outreach_templates
  ON public.hemp_homes_outreach_templates;
CREATE TRIGGER set_updated_at_hemp_homes_outreach_templates
  BEFORE UPDATE ON public.hemp_homes_outreach_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hemp_homes_outreach_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- OUTREACH LOG (drafts + sends)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hemp_homes_prospect_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.hemp_homes_community_prospects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.hemp_homes_outreach_templates(id) ON DELETE SET NULL,
  -- Draft content
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  drafted_subject TEXT NOT NULL,
  drafted_preview TEXT,
  drafted_body_md TEXT NOT NULL,
  drafted_body_html TEXT,
  drafted_to_addresses TEXT[] NOT NULL DEFAULT '{}',
  -- Review
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN (
    'pending','approved','discarded','rerolled'
  )),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_edited BOOLEAN NOT NULL DEFAULT false,
  -- Send
  sent_at TIMESTAMPTZ,
  resend_message_id TEXT,
  -- Delivery + engagement (populated by Resend webhooks; nullable until events arrive)
  delivery_status TEXT CHECK (delivery_status IN (
    'queued','sent','bounced','complained','opened','clicked','replied'
  )),
  bounced_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hh_outreach_prospect_generated
  ON public.hemp_homes_prospect_outreach(prospect_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hh_outreach_pending
  ON public.hemp_homes_prospect_outreach(generated_at DESC)
  WHERE review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_hh_outreach_resend_msg
  ON public.hemp_homes_prospect_outreach(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_hemp_homes_prospect_outreach
  ON public.hemp_homes_prospect_outreach;
CREATE TRIGGER set_updated_at_hemp_homes_prospect_outreach
  BEFORE UPDATE ON public.hemp_homes_prospect_outreach
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hemp_homes_prospect_outreach ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROSPECT LIFECYCLE COLUMN
-- ============================================================================

ALTER TABLE public.hemp_homes_community_prospects
  ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'idle' CHECK (outreach_status IN (
    'idle','queued','sent','in_conversation','no_reply','paused','declined'
  )),
  ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMPTZ;

-- ============================================================================
-- REVENUE VIEW REBUILD (capture new prospect columns)
-- ============================================================================

DROP VIEW IF EXISTS public.hemp_homes_community_prospects_revenue;

CREATE VIEW public.hemp_homes_community_prospects_revenue AS
SELECT
  p.*,
  COALESCE(p.indicative_lot_potential, 0)::numeric * a.capture_conservative * a.price_mid AS conservative_revenue,
  COALESCE(p.indicative_lot_potential, 0)::numeric * a.capture_base         * a.price_mid AS base_revenue,
  COALESCE(p.indicative_lot_potential, 0)::numeric * a.capture_optimistic   * a.price_mid AS optimistic_revenue
FROM public.hemp_homes_community_prospects p
CROSS JOIN public.hemp_homes_pricing_assumptions a
WHERE a.id = 'singleton';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.hemp_homes_outreach_templates IS
  'DB-stored outreach templates. Liquid-style {{ var }} substitution against prospect data, then LLM polish via llm_instruction. auto_send=false (Phase 1) means every draft routes through the human approval queue.';

COMMENT ON TABLE public.hemp_homes_prospect_outreach IS
  'One row per generation attempt — drafts, sends, and Resend webhook events. Survives discard/reroll so the history is complete.';

COMMENT ON COLUMN public.hemp_homes_community_prospects.outreach_status IS
  'Outreach lifecycle. Cron evaluator skips paused + declined. Transitions: idle → queued (draft generated) → sent (approved+sent) → in_conversation (reply received) | no_reply (after follow-up window).';
