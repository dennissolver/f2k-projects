-- Workstream 3: Unassigned handling
-- - Add 'house' to ownership enum for Direct/House registrations
-- - Create admin_notifications table
-- - Auto-assign 'house' ownership when no referrer
-- - Claim/reassign functionality with audit logging

-- 1. Add 'house' to ownership enum (idempotent)
DO $$ BEGIN
  CREATE TYPE ownership_state AS ENUM ('unassigned', 'house', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add ownership column to registration tables if not exists (handle existing data)
ALTER TABLE seafields_registrations 
  ADD COLUMN IF NOT EXISTS ownership ownership_state DEFAULT 'unassigned';

ALTER TABLE branscombe_registrations 
  ADD COLUMN IF NOT EXISTS ownership ownership_state DEFAULT 'unassigned';

-- 3. Migrate existing unassigned records to 'house' if they have no referrer
UPDATE seafields_registrations 
SET ownership = 'house' 
WHERE ownership = 'unassigned' 
  AND agent_id IS NULL 
  AND (referrer_type IS NULL OR referrer_type = '');

UPDATE branscombe_registrations 
SET ownership = 'house' 
WHERE ownership = 'unassigned' 
  AND agent_id IS NULL 
  AND (referrer_type IS NULL OR referrer_type = '');

-- 4. Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('unassigned_registration', 'registration_claimed', 'registration_reassigned', 'system_alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  entity_type TEXT,
  entity_id UUID,
  read_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_entity ON admin_notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);

-- RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin can read all
CREATE POLICY "Admin can read all notifications"
  ON admin_notifications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()
  ));

-- Service role full access
CREATE POLICY "Service role notifications full access"
  ON admin_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Create function to handle new unassigned registrations
CREATE OR REPLACE FUNCTION handle_new_registration()
RETURNS TRIGGER AS $$
DECLARE
  is_house BOOLEAN;
BEGIN
  -- Check if this is a "house" registration (no referrer)
  is_house := NEW.agent_id IS NULL 
    AND (NEW.referrer_type IS NULL OR NEW.referrer_type = '');

  IF is_house THEN
    NEW.ownership := 'house';
    
    -- Create notification for admin
    INSERT INTO admin_notifications (type, title, message, priority, entity_type, entity_id, created_by, metadata)
    VALUES (
      'unassigned_registration',
      'New Direct Registration',
      format('New registration from %s %s (%s) requires attention. No referrer assigned.',
        NEW.first_name, NEW.last_name, NEW.email),
      'normal',
      'seafields_registration',
      NEW.id,
      NULL,
      jsonb_build_object(
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'email', NEW.email,
        'source', NEW.source
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create triggers on registration tables
DROP TRIGGER IF EXISTS trigger_handle_new_seafields_registration ON seafields_registrations;
CREATE TRIGGER trigger_handle_new_seafields_registration
  BEFORE INSERT ON seafields_registrations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_registration();

DROP TRIGGER IF EXISTS trigger_handle_new_branscombe_registration ON branscombe_registrations;
CREATE TRIGGER trigger_handle_new_branscombe_registration
  BEFORE INSERT ON branscombe_registrations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_registration();

-- 7. Add indexes for ownership filtering
CREATE INDEX IF NOT EXISTS idx_seafields_regs_ownership ON seafields_registrations(ownership);
CREATE INDEX IF NOT EXISTS idx_branscombe_regs_ownership ON branscombe_registrations(ownership);

COMMENT ON FUNCTION handle_new_registration() IS 'Automatically assigns house ownership to registrations without a referrer and creates admin notification';
