-- 0058_developer_onboarding_intake.sql
--
-- Evolve the developer-onboarding submission into the "fully formed intake" — capturing the
-- DETERMINISTIC fields that let the estate page + funder summary build with minimal LLM guessing
-- (archetype, target market, land uses, lot-size mix, indicative land cost + market values, the
-- estate's sales agents to onboard), the WHY-ATTRACTIVE narrative, and the COMMERCIAL GATE
-- (acknowledging F2K as estate manager — the value capture — + an authority confirmation since an
-- agent may submit on the owner's behalf).

ALTER TABLE public.developer_onboarding
  ADD COLUMN IF NOT EXISTS archetype           TEXT,        -- subdivision | house_and_land | mixed_use | unsure
  ADD COLUMN IF NOT EXISTS target_market       TEXT[],      -- FHB / investor / downsizer / essential / retiree / owner-occ
  ADD COLUMN IF NOT EXISTS land_uses           TEXT[],      -- residential / childcare / aged_care / commercial / school / recreation / tourism
  ADD COLUMN IF NOT EXISTS lot_size_mix        TEXT,
  ADD COLUMN IF NOT EXISTS why_attractive      TEXT,        -- narrative: why it suits that market
  ADD COLUMN IF NOT EXISTS land_cost           NUMERIC,     -- indicative land / acquisition cost
  ADD COLUMN IF NOT EXISTS market_value_note   TEXT,        -- current market values / comps as at submission date
  ADD COLUMN IF NOT EXISTS agents              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name,agency,mobile,email}] to onboard
  ADD COLUMN IF NOT EXISTS terms_accepted_at   TIMESTAMPTZ, -- F2K-as-estate-manager acknowledgement
  ADD COLUMN IF NOT EXISTS authority_confirmed BOOLEAN NOT NULL DEFAULT FALSE; -- submitter has authority to agree
