-- 0059_email_consent_and_suppressions.sql
--
-- Australian Spam Act 2003 support for registrant-facing email.
--
-- 1. consent_at: when a registrant ticked the opt-in (express consent), record the
--    timestamp alongside the existing `consent` boolean — proof-of-consent for the
--    pillar-1 requirement. Added to every public registration table.
-- 2. email_suppressions: a central opt-out list. The registrant acknowledgement emails
--    carry a one-click unsubscribe (a signed link, no per-row token needed); the
--    unsubscribe route writes here, and any future marketing send checks it before sending.
--    Deny-by-default RLS (service-role only), consistent with the 0027 lockdown.
--
-- Idempotent + re-runnable.

-- 1. consent_at on each registration table (and consent on wavecrest, which predates it) -------
ALTER TABLE IF EXISTS public.seafields_registrations          ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.seafields_employer_registrations ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.funder_registrations             ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.dutton_registrations             ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.branscombe_registrations         ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.wavecrest_registrations          ADD COLUMN IF NOT EXISTS consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS public.wavecrest_registrations          ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;

-- 2. Central opt-out / suppression list -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored already-lowercased by the writer; UNIQUE so a repeat opt-out is a no-op upsert
  -- (onConflict targets this column).
  email          TEXT NOT NULL UNIQUE,
  suppressed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source         TEXT NOT NULL DEFAULT 'registrant-unsubscribe',  -- where the opt-out came from
  estate_slug    TEXT,                                            -- nullable: a global opt-out
  note           TEXT
);

-- Deny-by-default: RLS on, no public policy. Unsubscribe route + send-time checks use the
-- service-role key (bypasses RLS). Consistent with 0027.
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_suppressions IS
  'Central email opt-out list (Spam Act). The registrant acknowledgement unsubscribe link writes here; future marketing sends must check lower(email) before sending. Service-role only (RLS deny-by-default).';
