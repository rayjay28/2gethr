-- Add updated_at to task_comments so an edited comment can be distinguished
-- from a freshly posted one (used by the PATCH /api/tasks/[taskId]/comments
-- endpoint and its "Comment updated" notification).
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
