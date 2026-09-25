import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

// GET - List user's calendar sync connections
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const connections = await sql`
      SELECT 
        id, provider, provider_account_email, external_calendar_id,
        sync_enabled, sync_direction, sync_tasks, last_sync_at,
        created_at, updated_at
      FROM calendar_sync_connections
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      connections: connections.map(conn => ({
        id: conn.id,
        provider: conn.provider,
        calendarName: conn.provider_account_email || 'Google Calendar',
        externalCalendarId: conn.external_calendar_id,
        syncEnabled: conn.sync_enabled,
        syncDirection: conn.sync_direction,
        syncTasks: conn.sync_tasks ?? false,
        lastSyncedAt: conn.last_sync_at,
        createdAt: conn.created_at,
        updatedAt: conn.updated_at,
      })),
    })
  } catch (error) {
    console.error('Get connections error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

// DELETE - Disconnect a calendar sync
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID required' },
        { status: 400 }
      )
    }

    // Delete synced events for this connection
    await sql`
      DELETE FROM synced_events
      WHERE sync_connection_id = ${connectionId}
    `

    // Delete the connection
    const result = await sql`
      DELETE FROM calendar_sync_connections
      WHERE id = ${connectionId} AND user_id = ${user.id}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete connection error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}

// PATCH - Update sync settings
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const { connectionId, syncEnabled, syncDirection } = await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID required' },
        { status: 400 }
      )
    }

    const values: Record<string, unknown> = { connectionId, userId: user.id }

    if (typeof syncEnabled === 'boolean') {
      values.syncEnabled = syncEnabled
    }
    if (syncDirection) {
      values.syncDirection = syncDirection
    }

    const result = await sql`
      UPDATE calendar_sync_connections
      SET 
        sync_enabled = COALESCE(${values.syncEnabled ?? null}::boolean, sync_enabled),
        sync_direction = COALESCE(${values.syncDirection ?? null}::text, sync_direction),
        updated_at = NOW()
      WHERE id = ${connectionId} AND user_id = ${user.id}
      RETURNING id, sync_enabled, sync_direction
    `

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: result[0].id,
        syncEnabled: result[0].sync_enabled,
        syncDirection: result[0].sync_direction,
      },
    })
  } catch (error) {
    console.error('Update connection error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update connection' },
      { status: 500 }
    )
  }
}
