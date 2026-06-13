-- Developer onboarding — submitter role + land ownership
-- Adds who is enquiring (developer / land owner / agent / …), the site-control status
-- (the real green-light gate from the GBT project-development checklist — F2K can run
-- feasibility/planning/engineering, but the developer needs site control to proceed),
-- and the land owner's details for when the submitter ISN'T the owner (e.g. an agent
-- enquiring on a client's behalf). Land title / certificate-of-title documents continue
-- to live in the existing `uploads` JSONB, now tagged with a `category` per file.
--
-- All additive + idempotent. Service-role writes only; RLS stays deny-by-default (0027/0046).

ALTER TABLE developer_onboarding
  ADD COLUMN IF NOT EXISTS submitter_role    TEXT,
  -- Site ownership / control status (owned / under option / negotiating / not yet secured).
  ADD COLUMN IF NOT EXISTS site_control      TEXT,
  -- Land owner details when the submitter is not the owner: { name, email, phone, note }.
  ADD COLUMN IF NOT EXISTS landowner_details JSONB DEFAULT '{}'::jsonb;
