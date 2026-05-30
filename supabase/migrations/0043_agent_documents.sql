-- Agent documents storage table
CREATE TABLE IF NOT EXISTS agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own documents"
  ON agent_documents FOR ALL
  USING (agent_id = auth.uid()::text::uuid)
  WITH CHECK (agent_id = auth.uid()::text::uuid);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-documents', 'agent-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy
CREATE POLICY "Agents can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Agents can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Agents can delete own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
