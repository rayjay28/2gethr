import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// POST - Add a comment to a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params
    const { content } = await request.json()
    
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }
    
    // Verify task exists and user has access
    const task = await sql`SELECT family_id FROM tasks WHERE id = ${taskId}`
    
    if (task.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    const membership = await sql`
      SELECT 1 FROM family_members
      WHERE family_id = ${task[0].family_id} AND user_id = ${user.id} AND is_active = true
    `
    
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    const commentId = crypto.randomUUID()
    const comment = await sql`
      INSERT INTO task_comments (id, task_id, user_id, message, created_at)
      VALUES (${commentId}, ${taskId}, ${user.id}, ${content.trim()}, NOW())
      RETURNING *
    `
    
    // Log comment in history
    await sql`
      INSERT INTO task_history (id, task_id, user_id, action, new_value, created_at)
      VALUES (${crypto.randomUUID()}, ${taskId}, ${user.id}, 'COMMENTED', ${JSON.stringify({ commentId: comment[0].id })}::jsonb, NOW())
    `
    
    return NextResponse.json({ data: comment[0] }, { status: 201 })
  } catch (error) {
    console.error('Task comment POST error:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
