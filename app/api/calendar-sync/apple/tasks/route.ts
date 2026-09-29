import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { putCalDavItem, buildVTodo, CalDavCredentials } from '@/lib/services/caldav'

const sql = neon(process.env.DATABASE_URL!)

// POST - Sync Togethr tasks to Apple Reminders (VTODO over CalDAV)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const connections = await sql`
      SELECT id, access_token_encrypted, apple_task_calendar_url, provider_account_email, sync_tasks
      FROM calendar_sync_connections
      WHERE user_id = ${user.id} AND provider = 'apple' AND sync_enabled = true
    `

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Apple Calendar connection found' },
        { status: 404 }
      )
    }

    const connection = connections[0]

    if (!connection.sync_tasks) {
      return NextResponse.json(
        { success: false, error: 'Task sync is not enabled' },
        { status: 400 }
      )
    }

    if (!connection.apple_task_calendar_url) {
      return NextResponse.json(
        { success: false, error: 'No Reminders list found in this iCloud account' },
        { status: 400 }
      )
    }

    const creds: CalDavCredentials = {
      username: connection.provider_account_email,
      password: decrypt(connection.access_token_encrypted),
    }
    const tasksCalendarUrl: string = connection.apple_task_calendar_url

    const familyMembers = await sql`
      SELECT family_id FROM family_members WHERE user_id = ${user.id} LIMIT 1
    `

    if (familyMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User is not part of any family' },
        { status: 400 }
      )
    }

    const familyId = familyMembers[0].family_id

    const tasks = await sql`
      SELECT t.id, t.title, t.description, t.due_date, t.status, t.updated_at,
             st.apple_reminder_uid, st.last_synced_at
      FROM tasks t
      LEFT JOIN synced_tasks st ON t.id = st.familyhub_task_id AND st.connection_id = ${connection.id}
      WHERE t.family_id = ${familyId}
      AND t.due_date IS NOT NULL
      AND t.status NOT IN ('ARCHIVED', 'CANCELLED')
      AND (st.id IS NULL OR t.updated_at > st.last_synced_at)
    `

    let synced = 0
    let errors = 0

    for (const task of tasks) {
      try {
        const uid: string = task.apple_reminder_uid || `togethr-task-${task.id}@togethr.app`
        const itemUrl = `${tasksCalendarUrl}${tasksCalendarUrl.endsWith('/') ? '' : '/'}${uid}.ics`

        const ics = buildVTodo({
          uid,
          title: task.title,
          description: task.description,
          due: task.due_date ? new Date(task.due_date) : null,
          completed: task.status === 'COMPLETED',
        })

        const ok = await putCalDavItem(itemUrl, creds, ics)
        if (!ok) {
          errors++
          continue
        }

        await sql`
          INSERT INTO synced_tasks (connection_id, familyhub_task_id, apple_reminder_uid, last_synced_at)
          VALUES (${connection.id}, ${task.id}, ${uid}, NOW())
          ON CONFLICT (connection_id, familyhub_task_id)
          DO UPDATE SET apple_reminder_uid = ${uid}, last_synced_at = NOW()
        `
        synced++
      } catch (err) {
        console.error('Error syncing task to Apple Reminders:', task.id, err)
        errors++
      }
    }

    await sql`
      UPDATE calendar_sync_connections SET last_sync_at = NOW() WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      synced,
      errors,
      message: `Synced ${synced} task(s) to Apple Reminders${errors > 0 ? `, ${errors} error(s)` : ''}`,
    })
  } catch (error) {
    console.error('Apple task sync error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync tasks to Apple Reminders' },
      { status: 500 }
    )
  }
}
