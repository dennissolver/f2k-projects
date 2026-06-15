-- 0052_funder_registrations.sql
--
-- Funder-facing registration-of-interest capture. Directed EXCLUSIVELY to registered
-- Australian banks (APRA-authorised ADIs) registering interest to fund F2K development
-- packages as a senior (50% + retail FRoR) or junior (10–50% of the remaining 50%) lender.
-- This is a separate audience + legal footing from the buyer registration tables.
--
-- One row per registration. Writes are performed exclusively by the service-role client
-- (see src/app/api/funders/register/route.ts), which bypasses RLS. RLS is enabled with no
-- public policies so the table is deny-by-default for anon/auth keys — consistent with the
-- anon RLS lockdown (migration 0027) and the developer_onboarding pattern (0046).

CREATE TABLE IF NOT EXISTS public.funder_registrations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_slug                TEXT,                       -- null = overview / all-projects
  lender_type                 TEXT NOT NULL CHECK (lender_type IN ('senior', 'junior')),
  org_name                    TEXT NOT NULL,              -- registered Australian bank name
  contact_name                TEXT NOT NULL,
  role_title                  TEXT,
  email                       TEXT NOT NULL,
  mobile                      TEXT,
  division                    TEXT,
  registered_bank_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  indicative_pct              NUMERIC,                    -- senior = 50; junior = 10..50
  indicative_amount           NUMERIC,                    -- pct/100 * package_amount_at_submit
  package_amount_at_submit    NUMERIC,                    -- snapshot of the project package size
  preferred_structure         TEXT,
  notes                       TEXT,
  upload_url                  TEXT,
  consent                     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Sloane discovery transcript captured client-side + submitted with the form (matches the
  -- developer_onboarding pattern). voice_conversation_id reserved for future server-side capture.
  voice_transcript            JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_conversation_id       TEXT,
  source_page                 TEXT,                       -- route the registration came from
  status                      TEXT NOT NULL DEFAULT 'new', -- new | contacted | qualified | passed
  inserted_via                TEXT DEFAULT 'web_form'
);

CREATE INDEX IF NOT EXISTS funder_registrations_project_type_created_idx
  ON public.funder_registrations (project_slug, lender_type, created_at DESC);

-- Deny-by-default: RLS on, no public policy. The register route + admin reads use the
-- service-role key (bypasses RLS). Belt-and-braces against any future client-side access.
ALTER TABLE public.funder_registrations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.funder_registrations IS
  'Registration of interest from registered Australian banks (ADIs) to fund F2K development packages as senior/junior lenders. One row per registration. Service-role writes only (RLS deny-by-default).';


-- Admin-editable recipient list for funder-registration notification emails. Mirrors
-- seafields_notify_recipients (0018) / branscombe_notify_recipients (0024). Seeded with
-- Dennis + Uwe; super_admin-only RLS (reads/writes go via the service role which bypasses RLS).
CREATE TABLE IF NOT EXISTS public.funder_notify_recipients (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funder_notify_recipients_active_idx
  ON public.funder_notify_recipients (active) WHERE active = TRUE;

ALTER TABLE public.funder_notify_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'funder_notify_recipients'
      AND policyname = 'fnr_recipients_super_admin_only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY fnr_recipients_super_admin_only
        ON public.funder_notify_recipients
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.role = 'super_admin'
          )
        )
    $policy$;
  END IF;
END $$;

INSERT INTO public.funder_notify_recipients (email, name, active)
VALUES
  ('dennis@factory2key.com.au', 'Dennis McMahon', TRUE),
  ('uwe@factory2key.com.au',    'Uwe Jacobs',     TRUE)
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE public.funder_notify_recipients IS
  'Recipients for funder-registration admin notifications. Mirrors seafields/branscombe notify-recipient tables. Service-role read/write; super_admin RLS as a guard.';


-- Storage bucket for funder-supplied documents (mandate / term sheet / capacity statement).
-- Public read (admins preview via getPublicUrl); writes are service-role only. Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('funder-registrations', 'funder-registrations', true)
ON CONFLICT (id) DO NOTHING;
