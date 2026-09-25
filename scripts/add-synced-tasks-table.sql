-- Add sync_tasks column to calendar_sync_connections if not exists
ALTER TABLE calendar_sync_connections ADD COLUMN IF NOT EXISTS sync_tasks BOOLEAN DEFAULT false;
ALTER TABLE calendar_sync_connections ADD COLUMN IF NOT EXISTS google_tasklist_id TEXT;

-- Create synced_tasks table for Google Tasks sync mapping
-- Using TEXT for connection_id to match calendar_sync_connections.id type
CREATE TABLE IF NOT EXISTS synced_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id TEXT NOT NULL,
  familyhub_task_id TEXT NOT NULL,
  google_task_id TEXT NOT NULL,
  google_tasklist_id TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, familyhub_task_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_synced_tasks_connection ON synced_tasks(connection_id);
CREATE INDEX IF NOT EXISTS idx_synced_tasks_familyhub ON synced_tasks(familyhub_task_id);
CREATE INDEX IF NOT EXISTS idx_synced_tasks_google ON synced_tasks(google_task_id);
