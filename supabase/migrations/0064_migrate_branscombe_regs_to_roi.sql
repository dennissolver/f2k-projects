-- 0064_migrate_branscombe_regs_to_roi.sql
--
-- Data migration: fold the legacy `branscombe_registrations` rows into the ROI portal's
-- two-artefact model (spec decision #2). Each legacy row carries BOTH light contact info AND
-- rich unit/price/finance data, so it maps to a waitlist_registrations row (light) PLUS a
-- linked registrations row (the EOI/qualification) that preserves the rich data in payload.
--
-- Attribution: the legacy `agent_id` (set by referrer attribution) becomes the introducing
-- agent on both new rows; agency resolved from the agent. first_touch_at = legacy created_at
-- when attributed.
--
-- Consent: legacy rows consented to the EOI ack (consent=true) → consent_privacy +
-- consent_nonbinding = true. consent_contact is set FALSE so the 48h auto-nudge never fires on
-- historical leads (F2K can still manually "Send qualification form", which checks suppression
-- not contact-consent). Migrated waitlist rows are status='qualified' (they already gave
-- preferences) which also keeps them out of the nudge query.
--
-- IDEMPOTENT: re-running skips rows already migrated (matched by payload->>'legacy_branscombe_id').
-- The legacy table + the old /api/branscombe/register route are left intact (the agent
-- "My Clients" dashboard still reads branscombe_registrations).

DO $$
DECLARE
  v_estate  uuid;
  rec       record;
  v_wid     uuid;
  v_units   int[];
  v_cat     text;
  v_agency  uuid;
  v_name    text;
  v_migrated int := 0;
BEGIN
  SELECT id INTO v_estate FROM public.estates WHERE slug = 'branscombe';
  IF v_estate IS NULL THEN
    RAISE EXCEPTION 'branscombe estate row missing — run 0062 first';
  END IF;

  FOR rec IN
    SELECT br.* FROM public.branscombe_registrations br
    WHERE NOT EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.payload ->> 'legacy_branscombe_id' = br.id::text
    )
  LOOP
    -- buyer_category map (new enum: owner-occupier | investor | first-home-buyer)
    v_cat := CASE
      WHEN rec.buyer_type ILIKE '%first home%' THEN 'first-home-buyer'
      WHEN rec.buyer_type ILIKE '%investor%' OR rec.buyer_profile ILIKE '%investor%' THEN 'investor'
      ELSE 'owner-occupier'
    END;

    -- ranked units: "U30" -> 30, preserve order, cap at 3
    SELECT array_agg(num ORDER BY ord) INTO v_units
    FROM (
      SELECT (regexp_replace(u, '\D', '', 'g'))::int AS num, ord
      FROM unnest(rec.units_selected) WITH ORDINALITY AS t(u, ord)
      WHERE u ~ '^[Uu][0-9]+$'
      ORDER BY ord
      LIMIT 3
    ) z;
    v_units := COALESCE(v_units, '{}');

    -- agency from the introducing agent (if any)
    v_agency := NULL;
    IF rec.agent_id IS NOT NULL THEN
      SELECT agency_id INTO v_agency FROM public.agents WHERE id = rec.agent_id;
    END IF;

    v_name := COALESCE(
      NULLIF(trim(COALESCE(rec.first_name, '') || ' ' || COALESCE(rec.last_name, '')), ''),
      rec.email
    );

    INSERT INTO public.waitlist_registrations
      (estate_id, introducing_agent_id, introducing_agency_id, first_touch_at,
       name, email, mobile, buyer_category, consent_privacy, consent_contact,
       status, submitted_at)
    VALUES
      (v_estate, rec.agent_id, v_agency,
       CASE WHEN rec.agent_id IS NOT NULL THEN rec.created_at ELSE NULL END,
       v_name, lower(rec.email), rec.phone, v_cat, TRUE, FALSE,
       'qualified', rec.created_at)
    RETURNING id INTO v_wid;

    INSERT INTO public.registrations
      (estate_id, waitlist_id, ranked_unit_numbers, introducing_agency_id, introducing_agent_id,
       payload, consent_privacy, consent_nonbinding, consent_contact, submitted_at, status)
    VALUES
      (v_estate, v_wid, v_units, v_agency, rec.agent_id,
       jsonb_strip_nulls(jsonb_build_object(
         'legacy_branscombe_id', rec.id::text,
         'migrated',             TRUE,
         'full_name',            v_name,
         'email',                lower(rec.email),
         'mobile',               rec.phone,
         'suburb',               rec.suburb,
         'postcode',             rec.postcode,
         'buyer_type',           rec.buyer_type,
         'buyer_profile',        rec.buyer_profile,
         'current_housing',      rec.current_housing,
         'purchase_timeline',    rec.purchase_timeline,
         'finance_status',       rec.finance_status,
         'how_heard',            rec.how_heard,
         'price_preferences',    rec.price_preferences,
         'referrer_type',        rec.referrer_type,
         'referrer_name',        rec.referrer_name,
         'referrer_company',     rec.referrer_company,
         'referrer_contact',     rec.referrer_contact,
         'notes',                rec.notes,
         'source',               rec.source
       )),
       TRUE, TRUE, FALSE, rec.created_at, 'new');

    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE 'migrated % legacy branscombe registration(s) into the ROI model', v_migrated;
END $$;
