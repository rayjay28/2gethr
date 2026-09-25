-- Add weekly_digest column to reminder_settings table
ALTER TABLE reminder_settings 
ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN reminder_settings.weekly_digest IS 'Whether user wants to receive weekly summary email digests';
