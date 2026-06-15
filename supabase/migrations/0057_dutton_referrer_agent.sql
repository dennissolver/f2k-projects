-- 0057_dutton_referrer_agent.sql
--
-- Add the referring-agent link to dutton_registrations so the register form can capture WHICH
-- agent referred the buyer (the same agent-dropdown pattern as Seafields/Branscombe — populated
-- from /api/public/agents). For Dutton the marketing agents are Harris Real Estate (Zen Hartree,
-- Rachel, Corey); they appear in the dropdown once added as agent records with dutton estate access.

ALTER TABLE public.dutton_registrations
  ADD COLUMN IF NOT EXISTS referrer_agent_id UUID REFERENCES public.agents (id) ON DELETE SET NULL;
