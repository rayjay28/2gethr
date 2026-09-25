-- Fix admin_action_logs.target_id column to be text instead of uuid
-- This is needed because user IDs are text (e.g., 'usr_demo_guardian') not UUIDs

ALTER TABLE admin_action_logs 
ALTER COLUMN target_id TYPE text USING target_id::text;
