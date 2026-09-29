import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { verifyCalDavCredentials } from '@/lib/services/caldav'

const sql = neon(process.env.DATABASE_URL!)

// POST - Connect an Apple ID (via CalDAV + app-specific password)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const { appleId, appPassword } = await request.json()

    if (!appleId || !appPassword) {
      return NextResponse.json(
        { success: false, error: 'Apple ID and app-specific password are required' },
        { status: 400 }
      )
    }

    // Discover the account's CalDAV collections. This also doubles as the
    // credential check - a bad Apple ID/password fails here with a clear
    // error rather than silently saving broken credentials.
    let discovery
    try {
      discovery = await verifyCalDavCredentials({ username: appleId, password: appPassword })
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Could not connect to iCloud CalDAV' },
        { status: 400 }
      )
    }

    if (!discovery.eventsCalendarUrl) {
      return NextResponse.json(
        { success: false, error: 'Could not find a calendar to sync with in this iCloud account' },
        { status: 400 }
      )
    }

    const familyMembership = await sql`
      SELECT family_id FROM family_members
      WHERE user_id = ${user.id} AND is_active = true
      ORDER BY joined_at ASC
      LIMIT 1
    `

    if (familyMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You need to be part of a family before connecting a calendar' },
        { status: 400 }
      )
    }

    const familyId = familyMembership[0].family_id

    // App-specific passwords don't expire like OAuth access tokens do, so
    // there's no refresh token and no token_expires_at to track - the same
    // encrypted value is reused as long as the connection is active.
    const encryptedPassword = encrypt(appPassword)

    const existing = await sql`
      SELECT id FROM calendar_sync_connections
      WHERE user_id = ${user.id} AND provider = 'apple'
    `

    if (existing.length > 0) {
      await sql`
        UPDATE calendar_sync_connections
        SET
          access_token_encrypted = ${encryptedPassword},
          external_calendar_id = ${discovery.eventsCalendarUrl},
          apple_caldav_server = ${discovery.server},
          apple_task_calendar_url = ${discovery.tasksCalendarUrl},
          provider_account_email = ${appleId},
          family_id = ${familyId},
          sync_enabled = true,
          updated_at = NOW()
        WHERE user_id = ${user.id} AND provider = 'apple'
      `
    } else {
      await sql`
        INSERT INTO calendar_sync_connections (
          user_id, family_id, provider, external_calendar_id, provider_account_email,
          apple_caldav_server, apple_task_calendar_url,
          access_token_encrypted, sync_enabled
        ) VALUES (
          ${user.id}, ${familyId}, 'apple', ${discovery.eventsCalendarUrl}, ${appleId},
          ${discovery.server}, ${discovery.tasksCalendarUrl},
          ${encryptedPassword}, true
        )
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Apple connect error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to connect Apple Calendar' },
      { status: 500 }
    )
  }
}
