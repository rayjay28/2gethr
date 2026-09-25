import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

// GET - Get user notification settings
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    // Get reminder settings (contains notification preferences)
    const settings = await sql`
      SELECT * FROM reminder_settings WHERE user_id = ${user.id}
    `

    if (settings.length === 0) {
      // Return defaults
      return NextResponse.json({
        success: true,
        data: {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          eventReminders: true,
          locationAlerts: true,
          weeklyDigest: false,
        }
      })
    }

    // Parse the settings - we store additional prefs in a jsonb column or defaults
    const s = settings[0]
    return NextResponse.json({
      success: true,
      data: {
        emailNotifications: s.email_enabled ?? true,
        pushNotifications: s.push_enabled ?? true,
        smsNotifications: s.sms_enabled ?? false,
        phoneAlerts: s.phone_alerts ?? false,
        eventReminders: true,
        locationAlerts: true,
        weeklyDigest: s.weekly_digest ?? false,
      }
    })
  } catch (error) {
    console.error("Get notification settings error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get settings" },
      { status: 500 }
    )
  }
}

// PATCH - Update user notification settings
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      emailNotifications, 
      pushNotifications,
      smsNotifications,
      phoneAlerts,
      eventReminders,
      locationAlerts,
      weeklyDigest 
    } = body

    // Check if settings exist
    const existing = await sql`
      SELECT id FROM reminder_settings WHERE user_id = ${user.id}
    `

    if (existing.length === 0) {
      // Create new settings
      await sql`
        INSERT INTO reminder_settings (
          id, user_id, email_enabled, push_enabled, sms_enabled, phone_alerts, weekly_digest,
          default_reminder_minutes, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()},
          ${user.id},
          ${emailNotifications ?? true},
          ${pushNotifications ?? true},
          ${smsNotifications ?? false},
          ${phoneAlerts ?? false},
          ${weeklyDigest ?? false},
          ARRAY[15, 60],
          NOW(),
          NOW()
        )
      `
    } else {
      // Update existing settings
      await sql`
        UPDATE reminder_settings SET
          email_enabled = COALESCE(${emailNotifications}, email_enabled),
          push_enabled = COALESCE(${pushNotifications}, push_enabled),
          sms_enabled = COALESCE(${smsNotifications}, sms_enabled),
          phone_alerts = COALESCE(${phoneAlerts}, phone_alerts),
          weekly_digest = COALESCE(${weeklyDigest}, weekly_digest),
          updated_at = NOW()
        WHERE user_id = ${user.id}
      `
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully"
    })
  } catch (error) {
    console.error("Update notification settings error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
