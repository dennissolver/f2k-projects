-- ROLLBACK for 0027_lockdown_anon_rls.sql
-- Recreates the exact pre-0027 policies. Run this to instantly revert if the
-- lockdown breaks an access path. (Reference file — not a numbered migration.)
-- NOTE: reverting re-opens the anon PII exposure; only use to restore service.

BEGIN;

DROP POLICY IF EXISTS service_role_all_admin_users ON public.admin_users;
CREATE POLICY service_role_all_admin_users ON public.admin_users
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_seafields_registrations ON public.seafields_registrations;
CREATE POLICY service_role_all_seafields_registrations ON public.seafields_registrations
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_branscombe_registrations ON public.branscombe_registrations;
CREATE POLICY service_role_all_branscombe_registrations ON public.branscombe_registrations
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_hemp_homes_waitlist ON public.hemp_homes_waitlist;
CREATE POLICY service_role_all_hemp_homes_waitlist ON public.hemp_homes_waitlist
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY public_read_seafields_allocations ON public.seafields_lot_allocations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY public_read_branscombe_allocations ON public.branscombe_unit_allocations
  FOR SELECT TO anon, authenticated USING (true);

COMMIT;
