-- Wavecrest Estate Registration Table
-- Registration of Interest model (no lot selection)

CREATE TABLE wavecrest_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  interest_type TEXT,
  suburb TEXT,
  postcode TEXT,
  buyer_type TEXT,
  buyer_profile TEXT,
  current_housing TEXT,
  purchase_timeline TEXT,
  finance_status TEXT,
  how_heard TEXT,
  referrer_type TEXT,
  referrer_name TEXT,
  referrer_company TEXT,
  referrer_contact TEXT,
  notes TEXT,
  source TEXT DEFAULT 'web-roi',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wavecrest_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert wavecrest_registrations"
  ON wavecrest_registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can select wavecrest_registrations"
  ON wavecrest_registrations FOR SELECT
  USING (true);
