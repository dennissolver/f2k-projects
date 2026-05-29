-- Delete incorrect email if exists, then add correct one
DELETE FROM admin_users WHERE email = 'dennsi@corporateaisolutions.com';

INSERT INTO admin_users (
  email,
  role,
  first_name,
  last_name,
  email_marketing_opt_in,
  created_at
) VALUES (
  'dennis@corporateaisolutions.com',
  'super_admin',
  'Dennis',
  'M',
  false,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  updated_at = NOW();
