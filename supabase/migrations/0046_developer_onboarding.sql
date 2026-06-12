-- Developer onboarding
-- Public-facing developer onboarding capability (separate from the agent portal).
-- Collects developer + estate details, a vision description, optional file uploads
-- (plans / sketches / drawings / preferred house designs) and the transcript of a
-- voice-guided discovery conversation. Submissions trigger manual estate-page
-- creation for now; automation is planned later.
--
-- Writes are performed exclusively by the service-role client (see
-- src/app/api/developers/onboarding/route.ts), which bypasses RLS. RLS is enabled
-- with no public policies so the table is deny-by-default for anon/auth keys —
-- consistent with the anon RLS lockdown (migration 0027).

CREATE TABLE IF NOT EXISTS developer_onboarding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Developer contact
  developer_name  TEXT NOT NULL,
  email           TEXT NOT NULL,
  mobile          TEXT,
  website         TEXT,
  -- Estate / project
  estate_name     TEXT NOT NULL,
  estate_location TEXT,
  estate_postcode TEXT,
  zoning_status   TEXT,
  vision          TEXT,
  deal_preferences TEXT,
  -- Voice discovery conversation: [{ role, content }, ...]
  voice_transcript JSONB DEFAULT '[]'::jsonb,
  -- Uploaded files: [{ name, path, url, size, type }, ...]
  uploads         JSONB DEFAULT '[]'::jsonb,
  status          TEXT DEFAULT 'new',
  source          TEXT DEFAULT 'web'
);

ALTER TABLE developer_onboarding ENABLE ROW LEVEL SECURITY;

-- Storage bucket for developer-supplied plans / sketches / drawings / house designs.
-- Public read (so admins can preview uploads via getPublicUrl); writes are
-- service-role only. Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('developer-onboarding', 'developer-onboarding', true)
ON CONFLICT (id) DO NOTHING;
