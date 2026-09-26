-- Create push_tokens table for storing FCM/APNs/Web Push tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- token alone must be unique: lib/services/push.ts upserts with
  -- ON CONFLICT (token), reassigning user_id if the same device token
  -- shows up under a different account. A composite UNIQUE(user_id, token)
  -- doesn't satisfy that ON CONFLICT target, so every insert threw
  -- "no unique or exclusion constraint matching ON CONFLICT" and
  -- registerPushToken() silently swallowed it and returned false.
  UNIQUE(token)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(user_id, is_active) WHERE is_active = true;

-- Create notification_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  phone_enabled BOOLEAN DEFAULT false,
  -- Notification types preferences
  event_reminders BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  location_alerts BOOLEAN DEFAULT true,
  family_updates BOOLEAN DEFAULT true,
  sos_alerts BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
