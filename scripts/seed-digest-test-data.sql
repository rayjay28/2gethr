-- Seed test data for weekly digest functionality
-- This creates a test user, family, and events so the admin digest page shows data

-- Create a test user (use email for conflict since that's the unique constraint)
INSERT INTO users (id, email, first_name, last_name, phone, password_hash, is_active, created_at, updated_at)
VALUES (
  'test-user-001',
  'ray.jacquet@yahoo.com',
  'Ray',
  'Jacquet',
  '+15551234567',
  '$2b$10$dummyhashfortestingonly',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = true;

-- Create a test family
INSERT INTO families (id, name, owner_id, created_at, updated_at)
VALUES (
  'test-family-001',
  'The Jacquet Family',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Add user to family as PARENT (use user_id, family_id as composite key check)
INSERT INTO family_members (id, user_id, family_id, role, is_active, created_at, updated_at)
VALUES (
  'test-member-001',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  'test-family-001',
  'PARENT',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'PARENT',
  is_active = true;

-- Create a calendar for the family
INSERT INTO calendars (id, family_id, name, color, is_default, is_shared, created_at, updated_at)
VALUES (
  'test-calendar-001',
  'test-family-001',
  'Family Calendar',
  '#3b4563',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Create some test events for this week
INSERT INTO events (id, calendar_id, title, description, start_time, end_time, status, created_by_id, created_at, updated_at)
VALUES 
(
  'test-event-001',
  'test-calendar-001',
  'Soccer Practice',
  'Weekly soccer practice at the park',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day' + INTERVAL '2 hours',
  'APPROVED',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  NOW(),
  NOW()
),
(
  'test-event-002',
  'test-calendar-001',
  'Family Dinner',
  'Dinner at grandma''s house',
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '3 days' + INTERVAL '3 hours',
  'APPROVED',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  NOW(),
  NOW()
),
(
  'test-event-003',
  'test-calendar-001',
  'Dentist Appointment',
  'Regular checkup',
  NOW() + INTERVAL '5 days',
  NOW() + INTERVAL '5 days' + INTERVAL '1 hour',
  'APPROVED',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = 'APPROVED';

-- Enable weekly digest for the user
INSERT INTO reminder_settings (id, user_id, weekly_digest, email_enabled, push_enabled, sms_enabled, created_at, updated_at)
VALUES (
  'test-reminder-001',
  (SELECT id FROM users WHERE email = 'ray.jacquet@yahoo.com'),
  true,
  true,
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  weekly_digest = true;

-- Verify the data
SELECT 'Users:' as info, COUNT(*) as count FROM users WHERE is_active = true;
SELECT 'Family Members (PARENT/GUARDIAN):' as info, COUNT(*) as count FROM family_members WHERE role IN ('PARENT', 'GUARDIAN') AND is_active = true;
SELECT 'Events this week:' as info, COUNT(*) as count FROM events WHERE status = 'APPROVED' AND start_time >= NOW() AND start_time <= NOW() + INTERVAL '7 days';
