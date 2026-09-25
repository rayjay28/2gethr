-- ============================================
-- Safe Link - Clean Up Test/Demo Data
-- Run this before going to production
-- ============================================

-- Remove demo notifications
DELETE FROM notifications WHERE id LIKE 'notif_demo_%';

-- Remove demo audit logs
DELETE FROM audit_logs WHERE id LIKE 'audit_demo_%';

-- Remove demo consents
DELETE FROM consents WHERE id LIKE 'consent_demo_%';

-- Remove demo location settings
DELETE FROM location_settings WHERE id LIKE 'loc_settings_%';

-- Remove demo subscription
DELETE FROM subscriptions WHERE id LIKE 'sub_demo_%';

-- Remove demo events (must delete participants first due to FK)
DELETE FROM event_participants WHERE event_id LIKE 'evt_demo_%';
DELETE FROM events WHERE id LIKE 'evt_demo_%';

-- Remove demo calendar
DELETE FROM calendars WHERE id LIKE 'cal_demo_%';

-- Remove demo saved places
DELETE FROM saved_places WHERE id LIKE 'place_demo_%';

-- Remove demo child profiles
DELETE FROM child_profiles WHERE id LIKE 'child_demo_%';

-- Remove demo family members
DELETE FROM family_members WHERE id LIKE 'fm_demo_%';

-- Remove demo users
DELETE FROM users WHERE id LIKE 'usr_demo_%';

-- Remove demo family
DELETE FROM families WHERE id LIKE 'fam_demo_%';

-- Verify cleanup
SELECT 'Cleanup complete. Remaining data:' as status;
SELECT 'Users: ' || COUNT(*) as count FROM users;
SELECT 'Families: ' || COUNT(*) as count FROM families;
SELECT 'Events: ' || COUNT(*) as count FROM events;
SELECT 'Admin roles: ' || COUNT(*) as count FROM admin_roles;
