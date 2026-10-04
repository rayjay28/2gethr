-- Lets a place's creator pick which notification channels a geofence
-- arrival/departure alert for that place uses (in_app, push, email, sms),
-- matching the same notify_channels convention already used by
-- tasks/events (see add-notify-channels-to-tasks-and-events.sql) and
-- reminders. NULL (the default) means "no override - use each recipient's
-- own notification settings from reminder_settings", matching existing
-- behavior for every place created before this column existed.
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS notify_channels TEXT[];
