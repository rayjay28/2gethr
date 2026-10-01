import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendPushToUser } from "@/lib/services/push"
import { sendEmail, isResendConfigured } from "@/lib/services/email"
import { sendSMS, isTwilioConfigured } from "@/lib/services/sms"

// This endpoint processes event reminders, refreshes digest cache, and sends weekly digest on Sundays
// Runs daily at 8 AM UTC - combined into single cron for Hobby account limit
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get("Authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    
    // Find events that need reminders sent
    // Look for events starting in the next 60 minutes that have reminder_minutes set
    //
    // e.status checks against the events.status Postgres enum, whose only
    // valid values are PENDING/APPROVED/REJECTED/CANCELLED/ARCHIVED - there
    // is no CONFIRMED. The previous 'CONFIRMED' literal here made every run
    // of this query throw NeonDbError "invalid input value for enum
    // event_status" before any reminder could ever be found, so no event
    // reminder (push, SMS, or email) has ever actually fired. APPROVED is
    // the status normal (non-rejected, non-cancelled) events end up with.
    const upcomingEvents = await sql`
      SELECT
        e.id, e.title, e.start_time, e.reminder_minutes, e.location,
        e.created_by_id, e.calendar_id,
        c.family_id
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      WHERE e.start_time > NOW()
        AND e.start_time <= NOW() + INTERVAL '60 minutes'
        AND e.status = 'APPROVED'
        AND e.reminder_minutes IS NOT NULL
        AND array_length(e.reminder_minutes, 1) > 0
    `

    let remindersSent = 0

    for (const event of upcomingEvents) {
      const eventStart = new Date(event.start_time)
      const minutesUntilEvent = Math.floor((eventStart.getTime() - now.getTime()) / (1000 * 60))
      
      // Check if any reminder minute matches (within 1 minute window)
      const reminderMinutes = event.reminder_minutes || []
      const shouldSendReminder = reminderMinutes.some((min: number) => 
        Math.abs(minutesUntilEvent - min) < 1
      )

      if (!shouldSendReminder) continue

      // Get all participants and family members who should receive the reminder
      const participants = await sql`
        SELECT DISTINCT u.id, u.email, u.phone, u.first_name
        FROM users u
        JOIN family_members fm ON u.id = fm.user_id
        WHERE fm.family_id = ${event.family_id}
          AND fm.is_active = true
        UNION
        SELECT DISTINCT u.id, u.email, u.phone, u.first_name
        FROM users u
        JOIN event_participants ep ON u.id = ep.user_id
        WHERE ep.event_id = ${event.id}
          AND ep.status != 'DECLINED'
      `

      // Create notifications for each participant
      for (const participant of participants) {
        // Check if we already sent this reminder
        const existing = await sql`
          SELECT id FROM notifications
          WHERE user_id = ${participant.id}
            AND type = 'EVENT_REMINDER'
            AND (data->>'eventId')::text = ${event.id}
            AND (data->>'reminderMinutes')::int = ${minutesUntilEvent}
            AND created_at > NOW() - INTERVAL '5 minutes'
        `

        if (existing.length > 0) continue

        // Get user's reminder settings
        const settings = await sql`
          SELECT push_enabled, email_enabled, sms_enabled, quiet_hours_start, quiet_hours_end
          FROM reminder_settings
          WHERE user_id = ${participant.id}
        `

        const userSettings = settings[0] || { push_enabled: true, email_enabled: true, sms_enabled: false }

        // Check quiet hours
        if (userSettings.quiet_hours_start && userSettings.quiet_hours_end) {
          const currentHour = now.getHours()
          const startHour = parseInt(userSettings.quiet_hours_start.split(':')[0])
          const endHour = parseInt(userSettings.quiet_hours_end.split(':')[0])
          
          if (startHour <= currentHour && currentHour < endHour) {
            continue // Skip during quiet hours
          }
        }

        // Create in-app notification
        const notificationId = crypto.randomUUID()
        const timeText = minutesUntilEvent <= 1 
          ? "now" 
          : minutesUntilEvent < 60 
            ? `in ${minutesUntilEvent} minutes`
            : `in ${Math.floor(minutesUntilEvent / 60)} hour${Math.floor(minutesUntilEvent / 60) > 1 ? 's' : ''}`

        await sql`
          INSERT INTO notifications (
            id, user_id, type, title, body, data, is_read, created_at
          )
          VALUES (
            ${notificationId},
            ${participant.id},
            'EVENT_REMINDER',
            ${'Upcoming: ' + event.title},
            ${`${event.title} starts ${timeText}${event.location ? ` at ${event.location}` : ''}`},
            ${JSON.stringify({
              eventId: event.id,
              reminderMinutes: minutesUntilEvent,
              startTime: event.start_time,
              location: event.location,
            })},
            false,
            NOW()
          )
        `

        remindersSent++

        // Send real push notification (system-level, via the service worker's
        // showNotification call) when the user has push enabled in Settings.
        if (userSettings.push_enabled) {
          try {
            await sendPushToUser(participant.id, {
              title: 'Upcoming: ' + event.title,
              body: `${event.title} starts ${timeText}${event.location ? ` at ${event.location}` : ''}`,
              data: { type: 'EVENT_REMINDER', eventId: event.id },
              clickAction: `/calendar/event/${event.id}`,
            })
          } catch (pushError) {
            console.error('[Reminder] Push send failed (non-fatal):', pushError)
          }
        }

        // Send email when the user has email enabled in Settings.
        if (userSettings.email_enabled && participant.email && isResendConfigured()) {
          try {
            await sendEmail({
              to: participant.email,
              subject: `Reminder: ${event.title}`,
              html: `<p>${event.title} starts ${timeText}${event.location ? ` at ${event.location}` : ''}.</p>`,
              text: `${event.title} starts ${timeText}${event.location ? ` at ${event.location}` : ''}.`,
            })
          } catch (emailError) {
            console.error('[Reminder] Email send failed (non-fatal):', emailError)
          }
        }

        // Check if family has SMS/Phone alert features based on subscription
        // Basic ($3.99): SMS notifications enabled
        // Premium ($7.99): Phone alerts + SMS enabled
        const familySubscription = await sql`
          SELECT tier FROM subscriptions
          WHERE family_id = ${event.family_id}
          AND status IN ('ACTIVE', 'TRIALING')
          ORDER BY created_at DESC LIMIT 1
        `

        const tier = familySubscription.length > 0 ? familySubscription[0].tier : 'FREE'
        const hasSmsNotifications = tier === 'PREMIUM' || tier === 'PREMIUM_PLUS'
        const hasPhoneAlerts = tier === 'PREMIUM_PLUS'

        // Send SMS only when: the user toggled sms_enabled on in Settings,
        // AND the family's subscription tier actually grants SMS (business
        // rule, independent of the user's own toggle), AND Twilio is
        // configured, AND we have a phone number on file.
        if (userSettings.sms_enabled && hasSmsNotifications && participant.phone && isTwilioConfigured()) {
          try {
            await sendSMS({
              to: participant.phone,
              body: `Togethr Reminder: "${event.title}" starts ${timeText}${event.location ? ` at ${event.location}` : ''}.`,
            })
          } catch (smsError) {
            console.error('[Reminder] SMS send failed (non-fatal):', smsError)
          }
        }

        // Phone (voice) alerts are a Premium Plus-only add-on with no
        // implementation yet elsewhere in the app (no sendPhoneAlert
        // service exists). Left as a log line rather than silently
        // claiming to send something that doesn't exist.
        if (hasPhoneAlerts && participant.phone) {
          console.log(`[Reminder] Family ${event.family_id} (${tier}): phone-alert eligible, not yet implemented`)
        }
      }
    }

    // Also refresh digest recipients cache (combined into this cron for Hobby account limit)
    const digestStats = await sql`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT f.id) as total_families,
        COUNT(DISTINCT CASE WHEN fm.role = 'PARENT' THEN u.id END) as parents,
        COUNT(DISTINCT CASE WHEN fm.role = 'GUARDIAN' THEN u.id END) as guardians
      FROM users u
      JOIN family_members fm ON u.id = fm.user_id
      JOIN families f ON fm.family_id = f.id
      LEFT JOIN reminder_settings rs ON u.id = rs.user_id
      WHERE u.is_active = true
      AND fm.is_active = true
      AND fm.role IN ('PARENT', 'GUARDIAN')
      AND (rs.weekly_digest = true OR rs.weekly_digest IS NULL)
    `

    console.log('[Cron] Digest recipients refresh:', digestStats[0])

    // On Sundays, also trigger weekly digest sending
    let weeklyDigestSent = 0
    const dayOfWeek = now.getUTCDay() // 0 = Sunday
    
    if (dayOfWeek === 0) {
      console.log('[Cron] Sunday detected - triggering weekly digest')
      // Call the weekly digest endpoint internally
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000'
        const digestResponse = await fetch(`${baseUrl}/api/cron/weekly-digest`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        })
        if (digestResponse.ok) {
          const digestResult = await digestResponse.json()
          weeklyDigestSent = digestResult.sent || 0
          console.log('[Cron] Weekly digest sent:', weeklyDigestSent)
        }
      } catch (digestError) {
        console.error('[Cron] Weekly digest error:', digestError)
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      weeklyDigestSent,
      digestStats: digestStats[0],
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Process reminders error:", error)
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 })
  }
}
