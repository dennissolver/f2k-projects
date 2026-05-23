-- 0026_hemp_homes_notify_recipients.sql
--
-- Hemp Homes equivalent of seafields_notify_recipients (mig 0018) and
-- branscombe_notify_recipients (mig 0024). Recipients of Hemp Homes
-- admin notifications: new waitlist registrations + future change/
-- digest events.
--
-- Seeded with Dennis, Uwe Jacobs, and Steve Tiley (Wandarra). Hemp-
-- specific list — Barry/Barrs stay on their respective estates.

CREATE TABLE IF NOT EXISTS hemp_homes_notify_recipients (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hhnr_active_idx
  ON hemp_homes_notify_recipients (active) WHERE active = TRUE;

ALTER TABLE hemp_homes_notify_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hemp_homes_notify_recipients'
      AND policyname = 'hhnr_super_admin_only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY hhnr_super_admin_only
        ON hemp_homes_notify_recipients
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

INSERT INTO hemp_homes_notify_recipients (email, name, active)
VALUES
  ('dennis@factory2key.com.au', 'Dennis McMahon',          TRUE),
  ('uwe@factory2key.com.au',    'Uwe Jacobs',              TRUE),
  ('steve@wandarra.com.au',     'Steve Tiley (Wandarra)',  TRUE)
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE hemp_homes_notify_recipients IS
  'Recipients for Hemp Homes admin notifications (new waitlist signups, future change/digest events). Editable from /admin/hemp-homes. Mirrors the seafields_notify_recipients (mig 0018) and branscombe_notify_recipients (mig 0024) patterns.';
