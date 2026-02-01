-- Create Admin Profile for current user
-- User ID: 3a6cade0-ca82-4101-b35d-e5be6490928a

INSERT INTO profiles (id, role, email, "createdAt")
VALUES (
  '3a6cade0-ca82-4101-b35d-e5be6490928a',
  'ADMIN',
  'admin@ecommerce.com',
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN';

-- Verify the profile was created
SELECT * FROM profiles WHERE id = '3a6cade0-ca82-4101-b35d-e5be6490928a';
