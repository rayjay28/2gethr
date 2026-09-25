import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/encryption'

const sql = neon(process.env.DATABASE_URL!)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date } | null> {
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

    const tokens = await response.json()
    return {
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
    }
  } catch {
    return null
  }
}

// POST - Manually trigger sync
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get the user's Google connection
    const connections = await sql`
      SELECT 
        id, access_token_encrypted, refresh_token_encrypted, 
        token_expires_at, external_calendar_id, sync_direction
      FROM calendar_sync_connections
      WHERE user_id = ${user.id} 
      AND provider = 'google'
      AND sync_enabled = true
    `

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Google Calendar connection found' },
        { status: 404 }
      )
    }

    const connection = connections[0]
    let accessToken = decrypt(connection.access_token_encrypted)

    // Check if token is expired and refresh if needed
    if (new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token_encrypted) {
        return NextResponse.json(
          { success: false, error: 'Token expired and no refresh token available' },
          { status: 401 }
        )
      }

      const refreshToken = decrypt(connection.refresh_token_encrypted)
      const newTokens = await refreshAccessToken(refreshToken)

      if (!newTokens) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh token' },
          { status: 401 }
        )
      }

      // Update the stored token
      const encryptedNewToken = encrypt(newTokens.accessToken)
      await sql`
        UPDATE calendar_sync_connections
        SET 
          access_token_encrypted = ${encryptedNewToken},
          token_expires_at = ${newTokens.expiresAt.toISOString()},
          updated_at = NOW()
        WHERE id = ${connection.id}
      `

      accessToken = newTokens.accessToken
    }

    // Get user's family
    const familyMembership = await sql`
      SELECT family_id FROM family_members
      WHERE user_id = ${user.id} AND is_active = true
      LIMIT 1
    `

    if (familyMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No family found' },
        { status: 404 }
      )
    }

    const familyId = familyMembership[0].family_id
    const syncDirection = connection.sync_direction

    let importedCount = 0
    let exportedCount = 0

    // Import events from Google Calendar
    if (syncDirection === 'import' || syncDirection === 'bidirectional') {
      const googleEventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.external_calendar_id}/events?` +
        new URLSearchParams({
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
        }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (googleEventsResponse.ok) {
        const googleEvents = await googleEventsResponse.json()
        
        // Get or create a calendar for imported events
        const calendars = await sql`
          SELECT id FROM calendars
          WHERE family_id = ${familyId} AND name = 'Google Calendar'
          LIMIT 1
        `

        let calendarId: string
        if (calendars.length === 0) {
          const newCalendar = await sql`
            INSERT INTO calendars (family_id, name, color, is_default)
            VALUES (${familyId}, 'Google Calendar', '#4285F4', false)
            RETURNING id
          `
          calendarId = newCalendar[0].id
        } else {
          calendarId = calendars[0].id
        }

        for (const gEvent of googleEvents.items || []) {
          if (!gEvent.id || !gEvent.summary) continue

          // Check if already synced
          const existingSynced = await sql`
            SELECT id FROM synced_events
            WHERE sync_connection_id = ${connection.id}
            AND external_event_id = ${gEvent.id}
          `

          if (existingSynced.length === 0) {
            const startTime = gEvent.start?.dateTime || gEvent.start?.date
            const endTime = gEvent.end?.dateTime || gEvent.end?.date
            const isAllDay = !gEvent.start?.dateTime

            // Create event in our system
            const newEvent = await sql`
              INSERT INTO events (
                calendar_id, title, description, location,
                start_time, end_time, is_all_day, status,
                visibility, created_by_id
              ) VALUES (
                ${calendarId}, ${gEvent.summary}, ${gEvent.description || null},
                ${gEvent.location || null}, ${startTime}, ${endTime},
                ${isAllDay}, 'SCHEDULED', 'FAMILY', ${user.id}
              )
              RETURNING id
            `

            // Record the sync mapping
            await sql`
              INSERT INTO synced_events (
                sync_connection_id, local_event_id, external_event_id, sync_direction
              ) VALUES (
                ${connection.id}, ${newEvent[0].id}, ${gEvent.id}, 'import'
              )
            `

            importedCount++
          }
        }
      }
    }

    // Export events to Google Calendar
    if (syncDirection === 'export' || syncDirection === 'bidirectional') {
      // Get local events that haven't been exported
      const localEvents = await sql`
        SELECT e.id, e.title, e.description, e.location, 
               e.start_time, e.end_time, e.is_all_day
        FROM events e
        JOIN calendars c ON e.calendar_id = c.id
        LEFT JOIN synced_events se ON se.local_event_id = e.id 
          AND se.sync_connection_id = ${connection.id}
        WHERE c.family_id = ${familyId}
        AND e.status != 'CANCELLED'
        AND e.start_time >= NOW()
        AND se.id IS NULL
        LIMIT 50
      `

      for (const event of localEvents) {
        const googleEvent = {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: event.is_all_day
            ? { date: new Date(event.start_time).toISOString().split('T')[0] }
            : { dateTime: new Date(event.start_time).toISOString() },
          end: event.is_all_day
            ? { date: new Date(event.end_time).toISOString().split('T')[0] }
            : { dateTime: new Date(event.end_time).toISOString() },
        }

        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${connection.external_calendar_id}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleEvent),
          }
        )

        if (createResponse.ok) {
          const createdEvent = await createResponse.json()
          
          await sql`
            INSERT INTO synced_events (
              sync_connection_id, local_event_id, external_event_id, sync_direction
            ) VALUES (
              ${connection.id}, ${event.id}, ${createdEvent.id}, 'export'
            )
          `

          exportedCount++
        }
      }
    }

    // Update last synced time
    await sql`
      UPDATE calendar_sync_connections
      SET last_synced_at = NOW(), updated_at = NOW()
      WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      imported: importedCount,
      exported: exportedCount,
      message: `Sync complete. Imported ${importedCount} events, exported ${exportedCount} events.`,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync calendar' },
      { status: 500 }
    )
  }
}
