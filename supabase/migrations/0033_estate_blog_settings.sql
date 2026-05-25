-- 0033_estate_blog_settings.sql
-- Operator-authored, per-estate context for the AI blog drafter. The operator
-- describes the estate/product in their own words ("Tell me about X…") on the
-- posts page; the drafter weaves it in (on top of the hard safety rules baked
-- into each estate's config). Keyed by the estate slug (hemp-homes/branscombe/
-- seafields). Service-role only.

CREATE TABLE IF NOT EXISTS public.estate_blog_settings (
  estate TEXT PRIMARY KEY,
  ai_context TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.estate_blog_settings (estate)
VALUES ('hemp-homes'), ('branscombe'), ('seafields')
ON CONFLICT (estate) DO NOTHING;

DROP TRIGGER IF EXISTS set_updated_at_estate_blog_settings ON public.estate_blog_settings;
CREATE TRIGGER set_updated_at_estate_blog_settings
  BEFORE UPDATE ON public.estate_blog_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.estate_blog_settings ENABLE ROW LEVEL SECURITY;
-- No public policies — service-role only.

COMMENT ON TABLE public.estate_blog_settings IS
  'Operator-authored per-estate context fed to the AI blog drafter (augments the config hard rules). Service-role only.';
