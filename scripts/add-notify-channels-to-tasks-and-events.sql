-- Lets a task/event creator pick which notification channels the
-- assignee/participants get for that specific item (in_app, push, email,
-- sms). NULL (the default) means "no override - use the recipient's own
-- notification settings from reminder_settings", matching existing
-- behavior for every task/event created before this column existed.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notify_channels TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS notify_channels TEXT[];
