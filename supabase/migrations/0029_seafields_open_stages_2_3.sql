-- 0029_seafields_open_stages_2_3.sql
--
-- LAUNCH STRATEGY CHANGE (authorised by Dennis 2026-05-25, at Uwe's request).
--
-- Uwe Jacobs (MD, Property Friends) asked to release Stages 2 and 3 alongside
-- Stage 1, rather than holding to the original "Stage 1 only" launch. His
-- trigger: Lots 310 and 311 (both Stage 3) were stated as available but
-- rendered grey ("Coming soon") on the public map because their stage was
-- still locked. Releasing Stages 2 & 3 makes the Stage 3 public lots
-- registrable (blue) and aligns the data with the existing landing copy.
--
-- The original price-escalation FOMO rationale for the staged release is moot:
-- as of migration 0022 pricing is flat size-bands with NO stage premium, so
-- opening more stages does not cannibalise a price ladder.
--
-- Safe-by-design for the two heritage lots Uwe wants withheld:
--   - Lot 323 (1522m², Stage 2) stays Reserved — it is status='withheld' +
--     allocation_bucket='heritage_retained', and the public view only treats a
--     lot as registrable when bucket='public' AND status='available'. Opening
--     Stage 2 cannot expose it.
--   - Lot 379 (818m², Stage 7) is NOT in scope here — Stage 7 stays locked
--     pending Uwe's discussion with Barry.
--
-- Stages 4-7 remain locked. Reversible: set is_open_for_registration=FALSE.

UPDATE stages
SET is_open_for_registration = TRUE
WHERE stage_number IN (2, 3);
