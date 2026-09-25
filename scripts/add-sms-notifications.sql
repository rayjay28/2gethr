-- Add SMS notification support to reminder_settings
ALTER TABLE reminder_settings 
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;

-- Add phone notification preferences
ALTER TABLE reminder_settings 
ADD COLUMN IF NOT EXISTS phone_alerts BOOLEAN DEFAULT false;

-- Add notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
