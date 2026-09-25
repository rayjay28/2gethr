import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { decrypt, encrypt } from '@/lib/encryption'

const sql = neon(process.env.DATABASE_URL!)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.access_token
  } catch {
    return null
  }
}

// Get or create Togethr task list in Google Tasks
async function getOrCreateTaskList(accessToken: string, connectionId: string): Promise<string | null> {
  try {
    // Check if we already have a task list ID stored
    const connections = await sql`
      SELECT google_tasklist_id FROM calendar_sync_connections WHERE id = ${connectionId}
    `
    
    if (connections[0]?.google_tasklist_id) {
      // Verify it still exists
      const verifyRes = await fetch(
        `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${connections[0].google_tasklist_id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (verifyRes.ok) {
        return connections[0].google_tasklist_id
      }
    }

    // List existing task lists to find Togethr list
    const listRes = await fetch(
      'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) return null

    const lists = await listRes.json()
    const familyHubList = lists.items?.find((list: { title: string }) => list.title === 'Togethr Tasks')

    if (familyHubList) {
      // Save the list ID
      await sql`
        UPDATE calendar_sync_connections SET google_tasklist_id = ${familyHubList.id} WHERE id = ${connectionId}
      `
      return familyHubList.id
    }

    // Create new task list
    const createRes = await fetch(
      'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Togethr Tasks' }),
      }
    )

    if (!createRes.ok) return null

    const newList = await createRes.json()
    
    // Save the list ID
    await sql`
      UPDATE calendar_sync_connections SET google_tasklist_id = ${newList.id} WHERE id = ${connectionId}
    `

    return newList.id
  } catch (error) {
    console.error('Error getting/creating task list:', error)
    return null
  }
}

// Sync Togethr tasks to Google Tasks
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get Google connection with task sync enabled
    const connections = await sql`
      SELECT id, encrypted_access_token, encrypted_refresh_token, sync_tasks
      FROM calendar_sync_connections
      WHERE user_id = ${user.id} AND provider = 'google' AND is_active = true
    `

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Google Calendar connection found' },
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

    // Decrypt tokens
    const refreshToken = decrypt(connection.encrypted_refresh_token)
    let accessToken = decrypt(connection.encrypted_access_token)

    // Refresh token
    const newAccessToken = await refreshAccessToken(refreshToken)
    if (newAccessToken) {
      accessToken = newAccessToken
      await sql`
        UPDATE calendar_sync_connections 
        SET encrypted_access_token = ${encrypt(newAccessToken)}
        WHERE id = ${connection.id}
      `
    }

    // Get or create task list
    const taskListId = await getOrCreateTaskList(accessToken, connection.id)
    if (!taskListId) {
      return NextResponse.json(
        { success: false, error: 'Failed to get or create Google Tasks list' },
        { status: 500 }
      )
    }

    // Get user's family
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

    // Get tasks with due dates that haven't been synced or need updating
    const tasks = await sql`
      SELECT t.id, t.title, t.description, t.due_date, t.status, t.updated_at,
             st.google_task_id, st.last_synced_at
      FROM tasks t
      LEFT JOIN synced_tasks st ON t.id = st.task_id AND st.connection_id = ${connection.id}
      WHERE t.family_id = ${familyId}
      AND t.due_date IS NOT NULL
      AND t.status NOT IN ('ARCHIVED', 'CANCELLED')
      AND (
        st.id IS NULL 
        OR t.updated_at > st.last_synced_at
      )
    `

    let synced = 0
    let errors = 0

    for (const task of tasks) {
      try {
        // Convert status
        const googleStatus = task.status === 'COMPLETED' ? 'completed' : 'needsAction'
        
        // Format due date (Google Tasks uses RFC 3339 date format)
        const dueDate = new Date(task.due_date).toISOString()

        const taskData = {
          title: task.title,
          notes: task.description || '',
          due: dueDate,
          status: googleStatus,
        }

        let googleTaskId = task.google_task_id

        if (googleTaskId) {
          // Update existing task
          const updateRes = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${googleTaskId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(taskData),
            }
          )

          if (!updateRes.ok) {
            // Task may have been deleted, try creating new one
            googleTaskId = null
          }
        }

        if (!googleTaskId) {
          // Create new task
          const createRes = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(taskData),
            }
          )

          if (createRes.ok) {
            const newTask = await createRes.json()
            googleTaskId = newTask.id
          } else {
            errors++
            continue
          }
        }

        // Upsert sync record
        await sql`
          INSERT INTO synced_tasks (connection_id, task_id, google_task_id, last_synced_at)
          VALUES (${connection.id}, ${task.id}, ${googleTaskId}, NOW())
          ON CONFLICT (connection_id, task_id)
          DO UPDATE SET google_task_id = ${googleTaskId}, last_synced_at = NOW()
        `

        synced++
      } catch (err) {
        console.error('Error syncing task:', task.id, err)
        errors++
      }
    }

    // Update last sync time
    await sql`
      UPDATE calendar_sync_connections SET last_sync_at = NOW() WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      synced,
      errors,
      message: `Synced ${synced} task(s) to Google Tasks${errors > 0 ? `, ${errors} error(s)` : ''}`,
    })
  } catch (error) {
    console.error('Task sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync tasks' },
      { status: 500 }
    )
  }
}

// Toggle task sync on/off
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { syncTasks } = body

    if (typeof syncTasks !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'syncTasks must be a boolean' },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE calendar_sync_connections 
      SET sync_tasks = ${syncTasks}
      WHERE user_id = ${user.id} AND provider = 'google' AND is_active = true
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Google connection found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, syncTasks })
  } catch (error) {
    console.error('Toggle task sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update task sync setting' },
      { status: 500 }
    )
  }
}
