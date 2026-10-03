import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { listCalDavItems, putCalDavItem, buildVEvent, parseIcsField, CalDavCredentials } from '@/lib/services/caldav'

const sql = neon(process.env.DATABASE_URL!)

// POST - Manually trigger Apple Calendar sync (also called by the client-side auto-sync timer)
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
      SELECT id, access_token_encrypted, external_calendar_id, apple_caldav_server,
             provider_account_email, sync_direction
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

    // A connection row can exist with sync_enabled = true but no stored
    // credentials/calendar URL - e.g. one left over from before the
    // connect flow required both, or a row whose connect attempt didn't
    // fully complete. decrypt() throws an opaque "Cannot read properties
    // of null (reading 'split')" on a null access_token_encrypted, which
    // told the user nothing useful. Fail clearly instead and point them
    // at reconnecting.
    if (!connection.access_token_encrypted || !connection.external_calendar_id) {
      return NextResponse.json(
        { success: false, error: 'Apple Calendar isn\'t fully connected. Reconnect it with your Apple ID and an app-specific password.' },
        { status: 400 }
      )
    }

    const creds: CalDavCredentials = {
      username: connection.provider_account_email,
      password: decrypt(connection.access_token_encrypted),
    }
    const eventsCalendarUrl: string = connection.external_calendar_id

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

    // Import: pull VEVENTs from iCloud into Togethr events
    if (syncDirection === 'import' || syncDirection === 'both') {
      const items = await listCalDavItems(eventsCalendarUrl, creds, 'VEVENT')

      const calendars = await sql`
        SELECT id FROM calendars WHERE family_id = ${familyId} AND name = 'Apple Calendar' LIMIT 1
      `
      let calendarId: string
      if (calendars.length === 0) {
        const newCalendar = await sql`
          INSERT INTO calendars (family_id, name, color, is_default)
          VALUES (${familyId}, 'Apple Calendar', '#EA4335', false)
          RETURNING id
        `
        calendarId = newCalendar[0].id
      } else {
        calendarId = calendars[0].id
      }

      for (const item of items) {
        const existingSynced = await sql`
          SELECT id FROM synced_events
          WHERE connection_id = ${connection.id} AND external_event_id = ${item.uid}
        `
        if (existingSynced.length > 0) continue

        const summary = parseIcsField(item.raw, 'SUMMARY')
        const dtStart = parseIcsField(item.raw, 'DTSTART')
        const dtEnd = parseIcsField(item.raw, 'DTEND')
        if (!summary || !dtStart) continue

        const isAllDay = !/T/.test(dtStart)
        const startTime = parseIcsDate(dtStart)
        const endTime = dtEnd ? parseIcsDate(dtEnd) : startTime

        // BUG FIX: events.status is a Postgres enum whose only valid values
        // are PENDING/APPROVED/REJECTED/CANCELLED/ARCHIVED - there is no
        // SCHEDULED (same class of bug already found/fixed in the reminders
        // cron). Every import insert here was throwing a NeonDbError on the
        // enum constraint, so Apple Calendar import has never actually
        // worked - the sync call always 500'd before anything landed.
        const newEvent = await sql`
          INSERT INTO events (
            calendar_id, title, description, location,
            start_time, end_time, is_all_day, status,
            visibility, created_by_id
          ) VALUES (
            ${calendarId}, ${summary}, ${parseIcsField(item.raw, 'DESCRIPTION')}, ${parseIcsField(item.raw, 'LOCATION')},
            ${startTime}, ${endTime}, ${isAllDay}, 'APPROVED', 'FAMILY', ${user.id}
          )
          RETURNING id
        `

        await sql`
          INSERT INTO synced_events (connection_id, local_event_id, external_event_id, sync_status, last_synced_at)
          VALUES (${connection.id}, ${newEvent[0].id}, ${item.uid}, 'synced', NOW())
        `
        importedCount++
      }
    }

    // Export: push local events that haven't been synced yet to iCloud
    if (syncDirection === 'export' || syncDirection === 'both') {
      const localEvents = await sql`
        SELECT e.id, e.title, e.description, e.location, e.start_time, e.end_time, e.is_all_day
        FROM events e
        JOIN calendars c ON e.calendar_id = c.id
        LEFT JOIN synced_events se ON se.local_event_id = e.id AND se.connection_id = ${connection.id}
        WHERE c.family_id = ${familyId}
        AND e.status != 'CANCELLED'
        AND e.start_time >= NOW()
        AND se.id IS NULL
        LIMIT 50
      `

      for (const event of localEvents) {
        const uid = `togethr-${event.id}@togethr.app`
        const itemUrl = `${eventsCalendarUrl}${eventsCalendarUrl.endsWith('/') ? '' : '/'}${uid}.ics`
        const ics = buildVEvent({
          uid,
          title: event.title,
          description: event.description,
          location: event.location,
          start: new Date(event.start_time),
          end: new Date(event.end_time),
          allDay: event.is_all_day,
        })

        const ok = await putCalDavItem(itemUrl, creds, ics)
        if (ok) {
          await sql`
            INSERT INTO synced_events (connection_id, local_event_id, external_event_id, sync_status, last_synced_at)
            VALUES (${connection.id}, ${event.id}, ${uid}, 'synced', NOW())
          `
          exportedCount++
        }
      }
    }

    await sql`
      UPDATE calendar_sync_connections
      SET last_sync_at = NOW(), updated_at = NOW()
      WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      imported: importedCount,
      exported: exportedCount,
      message: `Sync complete. Imported ${importedCount} events, exported ${exportedCount} events.`,
    })
  } catch (error) {
    console.error('Apple sync error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync Apple Calendar' },
      { status: 500 }
    )
  }
}

function parseIcsDate(value: string): string {
  // All-day dates come as YYYYMMDD; timed values as YYYYMMDDTHHMMSSZ (or without Z for floating time).
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/)
  if (!m) return new Date().toISOString()
  const [, y, mo, d, h, mi, s] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
}
