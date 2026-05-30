-- Task 3: Message logging table for email tracking
-- Logs all outbound messages (agent bulk email, welcome emails, etc.)

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel TEXT NOT NULL DEFAULT 'email',
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  recipient_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'pending')),
  error TEXT,
  provider_message_id TEXT,
  thread_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Admin policy: read all
CREATE POLICY "Admin can read all messages"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- Agent policy: read own messages only (where recipient_id = auth.uid())
CREATE POLICY "Agent can read own messages"
  ON messages FOR SELECT
  USING (
    recipient_id = (
      SELECT id FROM agents WHERE email = auth.jwt()->>'email'
    )
  );

-- No inserts/update/delete for agents - they can only read
-- Service role (admin functions) can do everything
CREATE POLICY "Service role full access"
  ON messages FOR ALL
  USING (auth.role() = 'service_role');

-- View for agents - hides internal columns
CREATE OR REPLACE VIEW agent_messages AS
SELECT
  id,
  direction,
  channel,
  sender_email,
  recipient_email,
  subject,
  body,
  status,
  created_at
FROM messages
WHERE direction = 'outbound'
  AND channel = 'email';

COMMENT ON VIEW agent_messages IS 'Agent-facing message view - hides internal columns (error, provider_message_id, metadata)';
