-- Seed admin data
-- Note: Super admin should be created via the setup API with a secure password
-- This script creates demo support tickets and risk flags for testing

-- First, let's verify the admin roles exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'SUPER_ADMIN') THEN
    RAISE NOTICE 'Admin roles not found. Run 003-admin-schema.sql first.';
    RETURN;
  END IF;
END $$;

-- Create some demo support tickets (if we have users)
DO $$
DECLARE
  v_user_id TEXT;
  v_family_id TEXT;
BEGIN
  -- Get a user if one exists
  SELECT id INTO v_user_id FROM users LIMIT 1;
  SELECT id INTO v_family_id FROM families LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Create sample support tickets
    INSERT INTO support_tickets (ticket_number, user_id, family_id, category, priority, status, subject, description)
    VALUES 
      ('TKT-2026-000001', v_user_id, v_family_id, 'BILLING', 'NORMAL', 'OPEN', 
       'Question about subscription', 'I would like to know more about the Premium features before upgrading.'),
      ('TKT-2026-000002', v_user_id, v_family_id, 'TECHNICAL', 'HIGH', 'OPEN',
       'App not syncing calendar', 'The calendar events are not showing up on my spouse''s phone after I create them.'),
      ('TKT-2026-000003', v_user_id, v_family_id, 'FEATURE_REQUEST', 'LOW', 'OPEN',
       'Suggestion: Add dark mode', 'It would be great to have a dark mode option for the app.')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created sample support tickets';
  ELSE
    RAISE NOTICE 'No users found. Run seed script first to create demo users.';
  END IF;
END $$;

-- Create sample risk flags
DO $$
DECLARE
  v_user_id TEXT;
  v_family_id TEXT;
BEGIN
  SELECT id INTO v_user_id FROM users LIMIT 1;
  SELECT id INTO v_family_id FROM families LIMIT 1;
  
  IF v_family_id IS NOT NULL THEN
    INSERT INTO risk_flags (family_id, user_id, flag_type, severity, status, description, evidence)
    VALUES 
      (v_family_id, v_user_id, 'PAYMENT_MISMATCH', 'LOW', 'OPEN',
       'Subscription payment method differs from account region',
       '{"detected_region": "US", "payment_region": "CA", "risk_score": 15}'::jsonb)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created sample risk flags';
  END IF;
END $$;

-- Output reminder
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin seed complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'To create a super admin account:';
  RAISE NOTICE '1. Navigate to /admin/setup';
  RAISE NOTICE '2. Fill in the first admin credentials';
  RAISE NOTICE '3. Use a strong password (12+ chars)';
  RAISE NOTICE '========================================';
END $$;
