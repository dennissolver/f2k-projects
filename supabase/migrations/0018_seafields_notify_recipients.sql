-- 0018_seafields_notify_recipients.sql
--
-- Admin-editable list of email recipients who receive Seafields notification
-- emails (new registrations, lot changes, daily digest). Replaces the
-- hardcoded to-array in src/app/api/seafields/register/route.ts.
--
-- Seeded with Dennis, Uwe, Barry — the three people Uwe + Dennis nominated
-- on 2026-05-22 as needing visibility on every Seafields event.

CREATE TABLE IF NOT EXISTS seafields_notify_recipients (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sfn_recipients_active_idx
  ON seafields_notify_recipients (active) WHERE active = TRUE;

-- RLS: super_admin only. Reads + writes from the admin API use the service
-- role key, which bypasses RLS, so the policy is a belt-and-braces guard
-- against any future client-side read attempt.
ALTER TABLE seafields_notify_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seafields_notify_recipients'
      AND policyname = 'sfn_recipients_super_admin_only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY sfn_recipients_super_admin_only
        ON seafields_notify_recipients
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

INSERT INTO seafields_notify_recipients (email, name, active)
VALUES
  ('dennis@factory2key.com.au', 'Dennis McMahon', TRUE),
  ('uwe@factory2key.com.au',    'Uwe Jacobs',     TRUE),
  ('barryh@hld.com.au',         'Barry Humfrey',  TRUE)
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE seafields_notify_recipients IS
  'Recipients for Seafields admin notifications (new registrations, lot changes, daily digest). Editable from /admin/seafields-registrations. Replaces the hardcoded to-array in the register route.';
