-- 0024_branscombe_notify_recipients.sql
--
-- Branscombe equivalent of the seafields_notify_recipients table (created
-- by migration 0018). Recipients of Branscombe admin notifications: new
-- registrations, unit-change events, and the daily digest.
--
-- Seeded with Dennis + Uwe. Barry is Seafields-only — not seeded here.

CREATE TABLE IF NOT EXISTS branscombe_notify_recipients (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bnr_active_idx
  ON branscombe_notify_recipients (active) WHERE active = TRUE;

ALTER TABLE branscombe_notify_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'branscombe_notify_recipients'
      AND policyname = 'bnr_super_admin_only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY bnr_super_admin_only
        ON branscombe_notify_recipients
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

INSERT INTO branscombe_notify_recipients (email, name, active)
VALUES
  ('dennis@factory2key.com.au', 'Dennis McMahon', TRUE),
  ('uwe@factory2key.com.au',    'Uwe Jacobs',     TRUE)
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE branscombe_notify_recipients IS
  'Recipients for Branscombe admin notifications (new registrations, unit changes, daily digest). Editable from /admin/branscombe-pipeline. Mirrors the seafields_notify_recipients pattern from migration 0018.';
