-- 0027_lockdown_anon_rls.sql
--
-- SECURITY FIX (P0). Several base tables carried RLS policies scoped to
-- {public} or {anon,authenticated} with USING(true). Combined with Supabase's
-- default table grants, that let the browser anon key read — and on the
-- FOR ALL tables, INSERT/UPDATE/DELETE — sensitive rows directly via PostgREST,
-- bypassing the app's server-side service-role layer and the identity-free
-- seafields_public_lots view.
--
-- Concretely, before this migration, anyone holding the public anon key
-- (shipped in every browser bundle) could:
--   - SELECT / INSERT / UPDATE / DELETE every row of seafields_registrations,
--     branscombe_registrations, hemp_homes_waitlist (full buyer PII + tamper),
--   - SELECT / INSERT / UPDATE / DELETE admin_users (admin-takeover risk),
--   - SELECT wholesale_price / allocated_to / notes off seafields_lot_allocations
--     and branscombe_unit_allocations.
--
-- Verified safe to lock (2026-05-24): every application read of these tables
-- goes through the service role — server API routes under src/app/api/**, and
-- the admin pages via createSupabaseService() — or through the masked
-- seafields_public_lots view. getAdminUser() reads admin_users via the service
-- role (bypasses RLS), and the admins_select_self / admins_update_self policies
-- (left intact) keep authenticated self-service working. No client-side anon
-- base-table reads exist (grep of src for .from(<base table>) in "use client"
-- files = none). The seafields_public_lots view is owner=postgres and NOT
-- security_invoker, so it keeps returning rows after the base table is locked.
--
-- NOT touched (intentional public surfaces): dwelling_types, stages (gated
-- reference data); hemp_homes_posts / _media / _journey_entries /
-- _community_prospects / _post_media (public content, gated where needed);
-- the three *_notify_recipients tables (TO public but gated by an
-- EXISTS(super_admin) check, so anon fails). audit_log is already service-role
-- scoped (not in the exposed set).

BEGIN;

-- 1. admin_users — was FOR ALL to {public}: anon could read the admin list and
--    (with default grants) insert itself as admin. Re-scope to service_role.
DROP POLICY IF EXISTS service_role_all_admin_users ON public.admin_users;
CREATE POLICY service_role_all_admin_users ON public.admin_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. seafields_registrations — was FOR ALL to {public} (buyer PII + tamper).
DROP POLICY IF EXISTS service_role_all_seafields_registrations ON public.seafields_registrations;
CREATE POLICY service_role_all_seafields_registrations ON public.seafields_registrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. branscombe_registrations — same.
DROP POLICY IF EXISTS service_role_all_branscombe_registrations ON public.branscombe_registrations;
CREATE POLICY service_role_all_branscombe_registrations ON public.branscombe_registrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. hemp_homes_waitlist — same.
DROP POLICY IF EXISTS service_role_all_hemp_homes_waitlist ON public.hemp_homes_waitlist;
CREATE POLICY service_role_all_hemp_homes_waitlist ON public.hemp_homes_waitlist
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. seafields_lot_allocations — anon SELECT leaked wholesale_price /
--    allocated_to / notes. Public reads go through seafields_public_lots.
DROP POLICY IF EXISTS public_read_seafields_allocations ON public.seafields_lot_allocations;

-- 6. branscombe_unit_allocations — same anon SELECT leak; public via server API.
DROP POLICY IF EXISTS public_read_branscombe_allocations ON public.branscombe_unit_allocations;

COMMIT;
