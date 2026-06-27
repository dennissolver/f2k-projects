-- 0062_estate_roi_portal_spine.sql
--
-- Phase 0 of the agent ROI portal (spec: docs/Branscombe_ROI_Portal_Form_BuildSpec_v2.1.md).
-- The GENERIC, config-driven estate spine: estates + units + the two registration artefacts
-- (light waitlist -> full qualification/EOI). Branscombe is the first tenant seeded here;
-- Seafields/Dutton stay on their existing per-estate tables and migrate onto this spine later.
--
-- Adding the next estate = new estates row + units seed, no schema change (acceptance #9).
--
-- All tables: service-role writes only (RLS deny-by-default, post-0027 secure pattern).
-- Attribution columns (introducing_agent/agency) are immutable once set by policy; enforced
-- in the API/trigger layer in Phase 1, not here.

-- ============================================================================
-- estates  (one row per estate; carries the representation control + controller identity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.estates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  address                  TEXT,
  -- The ONLY product header rendered for the estate (spec section 8). Lead with the honest
  -- split; never a bare "37 x 3-bed" claim. ACL-load-bearing.
  representation_statement TEXT,
  tenure_type              TEXT,                    -- e.g. 'strata' | 'torrens'
  privacy_policy_url       TEXT,
  -- The collecting/contacting entity named in consent + privacy notices (spec section 4).
  controller_entity        TEXT NOT NULL DEFAULT 'Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd',
  terms_version            TEXT NOT NULL DEFAULT 'v1',
  status                   TEXT NOT NULL DEFAULT 'active',  -- active | draft | closed
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.estates ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.estates IS
  'Config-driven estate registry for the agent ROI portal. representation_statement is the only product header rendered (spec section 8, ACL guardrail). Service-role writes only.';

-- ============================================================================
-- units  (per-home inventory; type/area/star render ONLY where authorised_for_display)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.units (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id              UUID NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  unit_number            INTEGER NOT NULL,
  type_code              TEXT,
  bedrooms               INTEGER,
  bathrooms              INTEGER,
  internal_area_m2       NUMERIC,
  deck_area_m2           NUMERIC,
  star_rating            NUMERIC,
  price_indicative       NUMERIC,                 -- NULL => render as "POA"
  -- When FALSE, type/beds/areas/star are NOT shown; the unit is selectable by number only
  -- (spec section 8). The representation guardrail's load-bearing flag.
  authorised_for_display BOOLEAN NOT NULL DEFAULT TRUE,
  status                 TEXT NOT NULL DEFAULT 'available',  -- available | reserved | sold | withheld
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (estate_id, unit_number)
);
CREATE INDEX IF NOT EXISTS units_estate_idx ON public.units (estate_id, unit_number);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.units IS
  'Per-home inventory. authorised_for_display gates whether type/area/star detail renders (spec section 8). Service-role writes only.';

-- ============================================================================
-- agents.attribution_token  (resolves the tokenised agent link /r/<estate>?ref=TOKEN)
-- ============================================================================
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS attribution_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS agents_attribution_token_key
  ON public.agents (attribution_token) WHERE attribution_token IS NOT NULL;
COMMENT ON COLUMN public.agents.attribution_token IS
  'Unique per-agent token behind /r/<estate>?ref=TOKEN. First-touch attribution stamp (spec section 4). Populated in Phase 1.';

-- ============================================================================
-- waitlist_registrations  (artefact 1 - light, top-of-funnel, estate-level interest)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.waitlist_registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id             UUID NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  -- Attribution: NULL agency/agent = the unassigned pool (F2K admin assigns). First-touch,
  -- immutable once set (enforced in the API/trigger layer, Phase 1).
  introducing_agency_id UUID,                      -- FK -> agencies (table added Phase 1)
  introducing_agent_id  UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  first_touch_at        TIMESTAMPTZ,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  mobile                TEXT,
  buyer_category        TEXT,                      -- owner-occupier | investor | first-home-buyer
  consent_contact       BOOLEAN NOT NULL DEFAULT FALSE,  -- required before any nudge (spec section 11)
  consent_privacy       BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version         TEXT,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitter_ip          TEXT,
  user_agent            TEXT,
  nudged_at             TIMESTAMPTZ,
  assigned_by           UUID,                      -- admin id, for unassigned -> assigned
  status                TEXT NOT NULL DEFAULT 'new',  -- new | contacted | qualified | withdrawn
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS waitlist_estate_idx ON public.waitlist_registrations (estate_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_agent_idx  ON public.waitlist_registrations (introducing_agent_id);
CREATE INDEX IF NOT EXISTS waitlist_email_idx  ON public.waitlist_registrations (lower(email));
ALTER TABLE public.waitlist_registrations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.waitlist_registrations IS
  'Artefact 1: light estate-level waitlist. consent_contact gates nudges (spec section 11). NULL agent = unassigned pool. Service-role writes only.';

-- ============================================================================
-- registrations  (artefact 2 - the qualification form / EOI; attribution copied from waitlist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id             UUID NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  waitlist_id           UUID REFERENCES public.waitlist_registrations(id) ON DELETE SET NULL,
  -- Up to three preferred homes, ordered by rank (index 0 = first preference).
  ranked_unit_numbers   INTEGER[] NOT NULL DEFAULT '{}',
  -- Copied from the waitlist record, immutable (spec section 4).
  introducing_agency_id UUID,
  introducing_agent_id  UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,  -- all qualification answers
  terms_version         TEXT,
  consent_privacy       BOOLEAN NOT NULL DEFAULT FALSE,
  consent_nonbinding    BOOLEAN NOT NULL DEFAULT FALSE,
  consent_contact       BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitter_ip          TEXT,
  user_agent            TEXT,
  status                TEXT NOT NULL DEFAULT 'new',  -- new | contacted | qualified | withdrawn
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS registrations_estate_idx   ON public.registrations (estate_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS registrations_waitlist_idx ON public.registrations (waitlist_id);
CREATE INDEX IF NOT EXISTS registrations_agent_idx    ON public.registrations (introducing_agent_id);
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.registrations IS
  'Artefact 2: the qualification form (EOI). Links back to waitlist_id; attribution copied immutable. All answers in payload jsonb. Service-role writes only.';

-- ============================================================================
-- Branscombe seed (first tenant). Approved DA = 36 x 3-bed + Unit 31 as 2-bed.
-- ============================================================================
INSERT INTO public.estates (slug, name, address, representation_statement, tenure_type, privacy_policy_url, terms_version, status)
VALUES (
  'branscombe',
  'Branscombe Estate',
  '122-124 Branscombe Road, Claremont TAS 7011',
  '36 of the 37 homes are 3-bedroom. Unit 31 is currently approved as 2-bedroom due to a lot-size constraint; an amendment to bring it into line as a 3-bedroom is being prepared, subject to Council approval.',
  'strata',
  '/privacy',
  'v1',
  'active'
)
ON CONFLICT (slug) DO UPDATE
  SET representation_statement = EXCLUDED.representation_statement,
      address                  = EXCLUDED.address,
      tenure_type              = EXCLUDED.tenure_type,
      updated_at               = NOW();

-- 37 units. type_code per the Unison layout assignment; area derived from type
-- (1A/1B = 104 m2, 2A/2B/2C = 114 m2); all 3-bed/2-bath/7-star EXCEPT Unit 31 (2-bed, approved DA).
INSERT INTO public.units
  (estate_id, unit_number, type_code, bedrooms, bathrooms, internal_area_m2, deck_area_m2, star_rating, authorised_for_display, status)
SELECT
  e.id,
  v.unit_number,
  v.type_code,
  CASE WHEN v.unit_number = 31 THEN 2 ELSE 3 END,                 -- Unit 31 = 2-bed (approved DA)
  2,
  CASE WHEN v.type_code IN ('1A','1B') THEN 104 ELSE 114 END,
  24,
  7,
  TRUE,
  'available'
FROM (VALUES
  (1,'1A'),(2,'1B'),(3,'1A'),(4,'2A'),(5,'2B'),(6,'2C'),(7,'1B'),(8,'2A'),(9,'1A'),(10,'2B'),
  (11,'1A'),(12,'1B'),(13,'2A'),(14,'1A'),(15,'2B'),(16,'2C'),(17,'1B'),(18,'2A'),(19,'1A'),(20,'2B'),
  (21,'2C'),(22,'1A'),(23,'1B'),(24,'2A'),(25,'2B'),(26,'2C'),(27,'1A'),(28,'1B'),(29,'2A'),(30,'2B'),
  (31,'2C'),(32,'1A'),(33,'1B'),(34,'2A'),(35,'2B'),(36,'2C'),(37,'1A')
) AS v(unit_number, type_code)
CROSS JOIN (SELECT id FROM public.estates WHERE slug = 'branscombe') e
ON CONFLICT (estate_id, unit_number) DO UPDATE
  SET type_code        = EXCLUDED.type_code,
      bedrooms         = EXCLUDED.bedrooms,
      bathrooms        = EXCLUDED.bathrooms,
      internal_area_m2 = EXCLUDED.internal_area_m2,
      deck_area_m2     = EXCLUDED.deck_area_m2,
      star_rating      = EXCLUDED.star_rating,
      updated_at       = NOW();
