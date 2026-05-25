-- 0034_estate_post_emails.sql
-- Email-send log + unsubscribe list for the estate blog (all estates).
-- Powers: dedup (never send the same post to the same address twice), the
-- 2/week per-subscriber frequency cap, and Spam-Act-compliant unsubscribe.
-- Keyed by estate slug. Service-role only.

CREATE TABLE IF NOT EXISTS public.estate_post_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate TEXT NOT NULL,
  post_id UUID NOT NULL,           -- references the estate's own posts table (no cross-table FK)
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','test','failed'))
);

-- One real send of a given post to a given address (test sends excluded so they
-- don't block the later real send).
CREATE UNIQUE INDEX IF NOT EXISTS uq_estate_post_emails_post_addr
  ON public.estate_post_emails(estate, post_id, email)
  WHERE status = 'sent';

-- Frequency-cap lookups: how many sends to this address in the last 7 days.
CREATE INDEX IF NOT EXISTS idx_estate_post_emails_addr_sent
  ON public.estate_post_emails(estate, email, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_email_optouts (
  estate TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (estate, email)
);

ALTER TABLE public.estate_post_emails  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_email_optouts ENABLE ROW LEVEL SECURITY;
-- No public policies — service-role only.

COMMENT ON TABLE public.estate_post_emails IS
  'Per-send log of estate blog-post emails. Dedup + 2/week frequency cap. Service-role only.';
COMMENT ON TABLE public.estate_email_optouts IS
  'Per-estate email unsubscribe list. Service-role only.';
