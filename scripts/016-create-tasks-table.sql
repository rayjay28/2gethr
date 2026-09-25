-- Create tasks table for family task/chore management
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  child_profile_id TEXT REFERENCES child_profiles(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'CHORE', -- CHORE, HOMEWORK, ERRAND, ACTIVITY, OTHER
  priority TEXT NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
  
  -- Scheduling
  due_date TIMESTAMPTZ,
  due_time TEXT, -- Optional time component (HH:MM format)
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- DAILY, WEEKLY, MONTHLY, or custom RRULE
  
  -- Status and approval workflow
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, APPROVED, REJECTED, CANCELLED
  completed_at TIMESTAMPTZ,
  completed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  
  -- Reminders
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_minutes INTEGER[] DEFAULT ARRAY[60, 1440], -- 1 hour and 1 day before
  
  -- Rewards (optional gamification)
  points_value INTEGER DEFAULT 0,
  reward_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_child_profile ON tasks(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_id);

-- Task comments for communication
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- Task history for audit trail
CREATE TABLE IF NOT EXISTS task_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- CREATED, UPDATED, COMPLETED, APPROVED, REJECTED, ASSIGNED, etc.
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
