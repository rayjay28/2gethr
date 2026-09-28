-- Adds a configurable auto-sync interval (10, 30, or 60 minutes) per
-- calendar sync connection. Previously calendar/task sync only happened
-- when the user clicked "Sync now" -- there was no automatic recurring
-- sync at all.

ALTER TABLE calendar_sync_connections
  ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (sync_interval_minutes IN (10, 30, 60));
