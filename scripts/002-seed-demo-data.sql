-- Safe Link Demo Data Seed Script
-- This script creates sample data for testing and demonstration

-- Note: Passwords are hashed with bcrypt. The demo password for all users is: Demo123!
-- Hash generated for 'Demo123!' with cost 12

-- Create demo users (using correct columns: first_name, last_name instead of display_name)
INSERT INTO users (id, email, password_hash, first_name, last_name, timezone, email_verified, is_active) VALUES
  ('usr_demo_parent1', 'parent@demo.safelink.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJHpJQaK', 'Sarah', 'Johnson', 'America/New_York', NOW(), true),
  ('usr_demo_parent2', 'dad@demo.safelink.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJHpJQaK', 'Mike', 'Johnson', 'America/New_York', NOW(), true),
  ('usr_demo_guardian', 'grandma@demo.safelink.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJHpJQaK', 'Helen', 'Johnson', 'America/New_York', NOW(), true),
  ('usr_demo_child1', 'emma@demo.safelink.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJHpJQaK', 'Emma', 'Johnson', 'America/New_York', NOW(), true),
  ('usr_demo_child2', 'jack@demo.safelink.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJHpJQaK', 'Jack', 'Johnson', 'America/New_York', NOW(), true)
ON CONFLICT (id) DO NOTHING;

-- Create demo family
INSERT INTO families (id, name, owner_id, invite_code, invite_expires_at) VALUES
  ('fam_demo_johnson', 'The Johnsons', 'usr_demo_parent1', 'DEMO1234', NOW() + INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Add family members (correct columns based on schema)
INSERT INTO family_members (id, family_id, user_id, role, nickname, is_active, can_create_events, requires_event_approval, can_override_conflicts, can_view_family_calendar, can_invite_members) VALUES
  ('fm_demo_parent1', 'fam_demo_johnson', 'usr_demo_parent1', 'PARENT', 'Mom', true, true, false, true, true, true),
  ('fm_demo_parent2', 'fam_demo_johnson', 'usr_demo_parent2', 'PARENT', 'Dad', true, true, false, true, true, true),
  ('fm_demo_guardian', 'fam_demo_johnson', 'usr_demo_guardian', 'GUARDIAN', 'Grandma', true, false, false, false, true, false),
  ('fm_demo_child1', 'fam_demo_johnson', 'usr_demo_child1', 'CHILD', 'Emma', true, true, true, false, true, false),
  ('fm_demo_child2', 'fam_demo_johnson', 'usr_demo_child2', 'CHILD', 'Jack', true, false, true, false, true, false)
ON CONFLICT (id) DO NOTHING;

-- Create child profiles (correct columns based on schema)
INSERT INTO child_profiles (id, family_member_id, display_name, age, grade, school, emergency_notes) VALUES
  ('child_demo_emma', 'fm_demo_child1', 'Emma Johnson', 12, '6th Grade', 'Lincoln Middle School', 'Allergic to peanuts'),
  ('child_demo_jack', 'fm_demo_child2', 'Jack Johnson', 9, '3rd Grade', 'Lincoln Elementary', NULL)
ON CONFLICT (id) DO NOTHING;

-- Create family calendar (correct columns)
INSERT INTO calendars (id, family_id, name, color, is_default, is_shared) VALUES
  ('cal_demo_family', 'fam_demo_johnson', 'Family Calendar', '#0d9488', true, true)
ON CONFLICT (id) DO NOTHING;

-- Create sample events (correct columns based on schema)
INSERT INTO events (id, calendar_id, created_by_id, title, description, start_time, end_time, is_all_day, location, visibility, status, color) VALUES
  ('evt_demo_1', 'cal_demo_family', 'usr_demo_parent1', 'Soccer Practice', 'Weekly soccer practice for Emma', NOW() + INTERVAL '1 day' + TIME '16:00', NOW() + INTERVAL '1 day' + TIME '17:30', false, 'Riverside Soccer Fields', 'FAMILY', 'APPROVED', '#22c55e'),
  ('evt_demo_2', 'cal_demo_family', 'usr_demo_parent1', 'Parent-Teacher Conference', 'Meet with Mrs. Thompson about Jack', NOW() + INTERVAL '3 days' + TIME '14:00', NOW() + INTERVAL '3 days' + TIME '14:30', false, 'Lincoln Elementary School', 'PRIVATE', 'APPROVED', '#3b82f6'),
  ('evt_demo_3', 'cal_demo_family', 'usr_demo_parent2', 'Family Movie Night', 'Pizza and movie at home', NOW() + INTERVAL '5 days' + TIME '19:00', NOW() + INTERVAL '5 days' + TIME '22:00', false, 'Home', 'FAMILY', 'APPROVED', '#a855f7'),
  ('evt_demo_4', 'cal_demo_family', 'usr_demo_parent1', 'Emma Dentist Appointment', 'Regular checkup', NOW() + INTERVAL '7 days' + TIME '09:00', NOW() + INTERVAL '7 days' + TIME '10:00', false, 'Bright Smiles Dental', 'PRIVATE', 'APPROVED', '#ef4444'),
  ('evt_demo_5', 'cal_demo_family', 'usr_demo_parent2', 'Birthday Party - Tommy', 'Jack friend birthday party', NOW() + INTERVAL '10 days' + TIME '14:00', NOW() + INTERVAL '10 days' + TIME '17:00', false, 'FunZone Play Center', 'FAMILY', 'APPROVED', '#f97316'),
  ('evt_demo_6', 'cal_demo_family', 'usr_demo_parent1', 'Spring Break', 'School closed for spring break', NOW() + INTERVAL '14 days', NOW() + INTERVAL '21 days', true, NULL, 'FAMILY', 'APPROVED', '#06b6d4')
ON CONFLICT (id) DO NOTHING;

-- Create a pending event (child request)
INSERT INTO events (id, calendar_id, created_by_id, title, description, start_time, end_time, is_all_day, location, visibility, status, color) VALUES
  ('evt_demo_pending', 'cal_demo_family', 'usr_demo_child1', 'Sleepover at Lily house', 'Can I sleep over at Lily house on Saturday?', NOW() + INTERVAL '6 days' + TIME '18:00', NOW() + INTERVAL '7 days' + TIME '10:00', false, '123 Oak Street', 'FAMILY', 'PENDING', '#f59e0b')
ON CONFLICT (id) DO NOTHING;

-- Create event request record (correct columns)
INSERT INTO event_requests (id, event_id, requestor_id, status, requested_at, request_notes) VALUES
  ('req_demo_1', 'evt_demo_pending', 'usr_demo_child1', 'PENDING', NOW(), 'Lily invited me for her birthday sleepover!')
ON CONFLICT (id) DO NOTHING;

-- Create event participants (correct columns)
INSERT INTO event_participants (id, event_id, user_id, status) VALUES
  ('ep_demo_1', 'evt_demo_1', 'usr_demo_child1', 'ACCEPTED'),
  ('ep_demo_2', 'evt_demo_4', 'usr_demo_child1', 'ACCEPTED'),
  ('ep_demo_3', 'evt_demo_5', 'usr_demo_child2', 'ACCEPTED')
ON CONFLICT (id) DO NOTHING;

-- Create saved places (correct columns)
INSERT INTO saved_places (id, family_id, name, address, latitude, longitude, radius, geofence_enabled, alert_on_arrival, alert_on_departure, icon, color) VALUES
  ('place_demo_home', 'fam_demo_johnson', 'Home', '456 Maple Avenue, Anytown, USA', 40.7128, -74.0060, 100, true, true, true, 'home', '#22c55e'),
  ('place_demo_school_emma', 'fam_demo_johnson', 'Emma School', 'Lincoln Middle School, 123 School St', 40.7200, -74.0100, 150, true, true, true, 'school', '#3b82f6'),
  ('place_demo_school_jack', 'fam_demo_johnson', 'Jack School', 'Lincoln Elementary, 100 Elementary Way', 40.7180, -74.0080, 150, true, true, true, 'school', '#3b82f6'),
  ('place_demo_soccer', 'fam_demo_johnson', 'Soccer Fields', 'Riverside Soccer Complex', 40.7300, -73.9900, 200, true, true, false, 'sports', '#f97316'),
  ('place_demo_grandma', 'fam_demo_johnson', 'Grandma House', '789 Oak Lane, Anytown, USA', 40.7050, -74.0200, 100, true, true, true, 'heart', '#ec4899')
ON CONFLICT (id) DO NOTHING;

-- Create location settings for children (correct columns)
INSERT INTO location_settings (id, family_member_id, share_with_family, mode, update_interval_sec) VALUES
  ('loc_settings_emma', 'fm_demo_child1', true, 'ACTIVE', 300),
  ('loc_settings_jack', 'fm_demo_child2', false, 'OFF', 900)
ON CONFLICT (id) DO NOTHING;

-- Create demo subscription (Premium trial - correct columns)
INSERT INTO subscriptions (id, family_id, tier, status, trial_ends_at, current_period_start, current_period_end) VALUES
  ('sub_demo_johnson', 'fam_demo_johnson', 'PREMIUM', 'TRIALING', NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;

-- Create some notifications (correct columns - no family_id or event_id, use data JSON)
INSERT INTO notifications (id, user_id, type, title, body, data, is_read) VALUES
  ('notif_demo_1', 'usr_demo_parent1', 'EVENT_APPROVAL_REQUEST', 'New Event Request', 'Emma requested to create "Sleepover at Lily house"', '{"childName": "Emma", "eventTitle": "Sleepover at Lily house", "eventId": "evt_demo_pending", "familyId": "fam_demo_johnson"}', false),
  ('notif_demo_2', 'usr_demo_parent1', 'EVENT_REMINDER', 'Event Reminder', '"Soccer Practice" starts tomorrow at 4:00 PM', '{"eventTitle": "Soccer Practice", "startTime": "4:00 PM", "eventId": "evt_demo_1"}', true)
ON CONFLICT (id) DO NOTHING;

-- Create consent records (correct columns)
INSERT INTO consents (id, user_id, type, granted, ip_address, granted_at) VALUES
  ('consent_demo_1', 'usr_demo_parent1', 'TERMS_OF_SERVICE', true, '127.0.0.1', NOW()),
  ('consent_demo_2', 'usr_demo_parent1', 'PRIVACY_POLICY', true, '127.0.0.1', NOW()),
  ('consent_demo_3', 'usr_demo_parent1', 'LOCATION_TRACKING', true, '127.0.0.1', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create audit log entries (correct columns - using valid enum values: CREATE, UPDATE, DELETE, etc.)
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value) VALUES
  ('audit_demo_1', 'usr_demo_parent1', 'CREATE', 'family', 'fam_demo_johnson', '{"familyName": "The Johnsons"}'),
  ('audit_demo_2', 'usr_demo_parent1', 'CREATE', 'family_member', 'fm_demo_child1', '{"childName": "Emma Johnson"}'),
  ('audit_demo_3', 'usr_demo_parent1', 'CREATE', 'family_member', 'fm_demo_child2', '{"childName": "Jack Johnson"}'),
  ('audit_demo_4', 'usr_demo_parent1', 'CREATE', 'event', 'evt_demo_1', '{"eventTitle": "Soccer Practice"}'),
  ('audit_demo_5', 'usr_demo_parent1', 'SUBSCRIPTION_CHANGE', 'subscription', 'sub_demo_johnson', '{"action": "trial_started", "tier": "PREMIUM"}')
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Demo data seeded successfully!' as status;
