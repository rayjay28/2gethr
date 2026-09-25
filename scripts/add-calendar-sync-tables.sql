-- Calendar Sync Integration Tables
-- Stores OAuth connections and event sync mappings

-- Table for storing calendar sync connections (Google, Apple, etc.)
CREATE TABLE IF NOT EXISTS calendar_sync_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_account_email TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'both' CHECK (sync_direction IN ('import', 'export', 'both')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  external_calendar_id TEXT,
  ical_token TEXT UNIQUE, -- For Apple Calendar subscription URL auth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Table for mapping local events to external calendar events
CREATE TABLE IF NOT EXISTS synced_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  local_event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES calendar_sync_connections(id) ON DELETE CASCADE,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  external_updated_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_event_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_sync_user ON calendar_sync_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_family ON calendar_sync_connections(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_provider ON calendar_sync_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_ical_token ON calendar_sync_connections(ical_token);
CREATE INDEX IF NOT EXISTS idx_synced_events_connection ON synced_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_synced_events_local ON synced_events(local_event_id);
CREATE INDEX IF NOT EXISTS idx_synced_events_status ON synced_events(sync_status);
