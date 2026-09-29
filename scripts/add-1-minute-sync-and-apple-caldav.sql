-- 1. Adds a 1-minute option to the calendar auto-sync interval (previously
--    only 10/30/60 were allowed - see add-sync-interval-column.sql).
-- 2. Adds a separate, independently-configurable interval for Task sync
--    (previously Task sync to Google Tasks had no interval at all - it was
--    manual "Sync Tasks Now" only, or piggybacked on the calendar timer
--    without actually being triggered by it).
-- 3. Adds the columns needed for Apple Calendar/Reminders sync over CalDAV,
--    which previously did not exist at all (only a one-way iCal
--    subscription feed did). Apple's CalDAV auth uses an app-specific
--    password rather than OAuth, so it reuses the existing
--    access_token_encrypted column (no refresh token needed - app-specific
--    passwords don't expire the way OAuth access tokens do).

ALTER TABLE calendar_sync_connections
  DROP CONSTRAINT IF EXISTS calendar_sync_connections_sync_interval_minutes_check;

ALTER TABLE calendar_sync_connections
  ADD CONSTRAINT calendar_sync_connections_sync_interval_minutes_check
    CHECK (sync_interval_minutes IN (1, 10, 30, 60));

ALTER TABLE calendar_sync_connections
  ADD COLUMN IF NOT EXISTS task_sync_interval_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (task_sync_interval_minutes IN (1, 10, 30, 60));

-- Full CalDAV collection URLs (not just an id like Google uses) - CalDAV
-- addresses calendars/task-lists by URL, discovered once at connect time
-- via PROPFIND/well-known lookup against the server in apple_caldav_server.
ALTER TABLE calendar_sync_connections
  ADD COLUMN IF NOT EXISTS apple_caldav_server TEXT;

ALTER TABLE calendar_sync_connections
  ADD COLUMN IF NOT EXISTS apple_task_calendar_url TEXT;

-- synced_tasks was built Google-only (google_task_id/google_tasklist_id are
-- NOT NULL - see add-synced-tasks-table.sql). Apple Reminders items are
-- identified by a CalDAV UID instead, so add a column for that and relax
-- the Google columns to nullable so an Apple-only sync row can be inserted.
ALTER TABLE synced_tasks
  ADD COLUMN IF NOT EXISTS apple_reminder_uid TEXT;

ALTER TABLE synced_tasks
  ALTER COLUMN google_task_id DROP NOT NULL;

ALTER TABLE synced_tasks
  ALTER COLUMN google_tasklist_id DROP NOT NULL;
