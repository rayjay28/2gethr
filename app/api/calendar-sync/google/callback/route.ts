import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { encrypt } from '@/lib/encryption'

const sql = neon(process.env.DATABASE_URL!)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar-sync/google/callback`
  : 'http://localhost:3000/api/calendar-sync/google/callback'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL('/settings/calendar-sync?error=denied', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings/calendar-sync?error=missing_params', request.url))
    }

    // Decode state to get user ID
    let userId: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = stateData.userId
    } catch {
      return NextResponse.redirect(new URL('/settings/calendar-sync?error=invalid_state', request.url))
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/settings/calendar-sync?error=token_exchange', request.url))
    }

    const tokens = await tokenResponse.json()

    // Get user's primary calendar info
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )

    let externalCalendarId = 'primary'
    let calendarName = 'Google Calendar'
    
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json()
      externalCalendarId = calendarData.id || 'primary'
      calendarName = calendarData.summary || 'Google Calendar'
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in * 1000))

    // Check if connection already exists
    const existing = await sql`
      SELECT id FROM calendar_sync_connections 
      WHERE user_id = ${userId} AND provider = 'google'
    `

    if (existing.length > 0) {
      // Update existing connection
      await sql`
        UPDATE calendar_sync_connections
        SET 
          access_token_encrypted = ${encryptedAccessToken},
          refresh_token_encrypted = ${encryptedRefreshToken},
          token_expires_at = ${tokenExpiry.toISOString()},
          external_calendar_id = ${externalCalendarId},
          calendar_name = ${calendarName},
          sync_enabled = true,
          updated_at = NOW()
        WHERE user_id = ${userId} AND provider = 'google'
      `
    } else {
      // Create new connection
      await sql`
        INSERT INTO calendar_sync_connections (
          user_id, provider, external_calendar_id, calendar_name,
          access_token_encrypted, refresh_token_encrypted, token_expires_at,
          sync_enabled
        ) VALUES (
          ${userId}, 'google', ${externalCalendarId}, ${calendarName},
          ${encryptedAccessToken}, ${encryptedRefreshToken}, ${tokenExpiry.toISOString()},
          true
        )
      `
    }

    return NextResponse.redirect(new URL('/settings/calendar-sync?success=google', request.url))
  } catch (error) {
    console.error('Google callback error:', error)
    return NextResponse.redirect(new URL('/settings/calendar-sync?error=callback_failed', request.url))
  }
}
