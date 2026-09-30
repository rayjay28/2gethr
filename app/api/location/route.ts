import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest, checkFamilySubscription, logAuditEvent } from "@/lib/auth"
import { z } from "zod"

const locationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional().nullable(),
  altitude: z.number().optional().nullable(),
  speed: z.number().min(0).optional().nullable(),
  heading: z.number().min(0).max(360).optional().nullable(),
  batteryLevel: z.number().int().min(0).max(100).optional().nullable(),
  timestamp: z.string().datetime().optional().nullable(),
  memberId: z.string().optional().nullable(),
  familyId: z.string().optional().nullable(),
})

// Get family members' locations (for authorized users)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    const familyId = request.nextUrl.searchParams.get("familyId") || user.primaryFamily?.id

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: "No family specified" },
        { status: 400 }
      )
    }

    // Verify user is a PARENT or GUARDIAN in this family
    const membership = await sql`
      SELECT role FROM family_members 
      WHERE family_id = ${familyId} AND user_id = ${user.id} AND is_active = true
    `

    if (membership.length === 0) {
      return NextResponse.json(
        { success: false, error: "Not a member of this family" },
        { status: 403 }
      )
    }

    const userRole = membership[0].role
    const isParentOrGuardian = userRole === "PARENT" || userRole === "GUARDIAN"

    // Check subscription allows location sharing (Premium only)
    const subscription = await checkFamilySubscription(familyId)
    if (!subscription.features.locationSharing) {
      return NextResponse.json(
        { success: false, error: "Location sharing requires a Premium subscription", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      )
    }

    // Get members with their location settings and pings
    const locations = await sql`
      SELECT 
        fm.id as member_id, fm.user_id, fm.nickname, fm.role,
        COALESCE(ls.mode, 'OFF') as location_mode, 
        COALESCE(ls.share_with_family, false) as share_with_family,
        lp.latitude, lp.longitude, lp.accuracy, lp.altitude,
        lp.speed, lp.heading, lp.battery_level, lp.timestamp,
        u.first_name, u.last_name, u.profile_photo_path,
        cp.display_name as child_display_name
      FROM family_members fm
      LEFT JOIN location_settings ls ON fm.id = ls.family_member_id
      LEFT JOIN LATERAL (
        SELECT * FROM location_pings 
        WHERE user_id = fm.user_id 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) lp ON true
      LEFT JOIN users u ON fm.user_id = u.id
      LEFT JOIN child_profiles cp ON fm.id = cp.family_member_id
      WHERE fm.family_id = ${familyId}
      AND fm.is_active = true
    `
    
    // Filter based on role:
    // - Parents/guardians can see all family members who have share_with_family enabled
    // - Children can only see family members who share their location (parents sharing with them)
    const filteredLocations = locations.filter(l => {
      // Must have share_with_family enabled and not be OFF
      if (l.share_with_family !== true || l.location_mode === 'OFF') {
        return false
      }
      // If user is a child, only show parents/guardians who are sharing
      if (!isParentOrGuardian) {
        return l.role === 'PARENT' || l.role === 'GUARDIAN'
      }
      return true
    })

    return NextResponse.json({
      success: true,
      data: filteredLocations.map(l => ({
        memberId: l.member_id,
        userId: l.user_id,
        name: l.child_display_name || l.nickname || `${l.first_name} ${l.last_name}`,
        role: l.role,
        profilePhotoPath: l.profile_photo_path,
        locationMode: l.location_mode,
        location: l.latitude !== null && l.longitude !== null ? {
          latitude: l.latitude,
          longitude: l.longitude,
          accuracy: l.accuracy,
          altitude: l.altitude,
          speed: l.speed,
          heading: l.heading,
          batteryLevel: l.battery_level,
          timestamp: l.timestamp,
        } : null,
      })),
    })
  } catch (error) {
    console.error("Get locations error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get locations" },
      { status: 500 }
    )
  }
}

// Post location ping (from mobile app)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = locationPingSchema.parse(body)

    // Build query to find the correct location settings
    // If memberId/familyId provided, use those; otherwise fall back to first match
    let settings
    if (validatedData.memberId && validatedData.familyId) {
      settings = await sql`
        SELECT ls.mode, ls.share_with_family, fm.family_id, fm.id as member_id
        FROM location_settings ls
        JOIN family_members fm ON ls.family_member_id = fm.id
        WHERE fm.id = ${validatedData.memberId}
          AND fm.family_id = ${validatedData.familyId}
          AND fm.user_id = ${user.id}
          AND fm.is_active = true
        LIMIT 1
      `
    } else {
      settings = await sql`
        SELECT ls.mode, ls.share_with_family, fm.family_id, fm.id as member_id
        FROM location_settings ls
        JOIN family_members fm ON ls.family_member_id = fm.id
        WHERE fm.user_id = ${user.id} AND fm.is_active = true
        LIMIT 1
      `
    }

    if (settings.length === 0) {
      return NextResponse.json(
        { success: false, error: "No location settings found" },
        { status: 400 }
      )
    }

    const setting = settings[0]

    // Check if location sharing is enabled and mode allows sharing
    if (!setting.share_with_family || setting.mode === "OFF" || setting.mode === "PAUSED") {
      return NextResponse.json(
        { success: false, error: "Location sharing is disabled" },
        { status: 400 }
      )
    }

    // Check subscription
    const subscription = await checkFamilySubscription(setting.family_id)
    if (!subscription.features.locationSharing) {
      return NextResponse.json(
        { success: false, error: "Location sharing requires the Premium plan", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      )
    }

    // Store location ping - use text-based ID to match column type
    const pingId = `ping_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    await sql`
      INSERT INTO location_pings (
        id, user_id, latitude, longitude, accuracy, altitude,
        speed, heading, battery_level, timestamp
      )
      VALUES (
        ${pingId},
        ${user.id},
        ${validatedData.latitude},
        ${validatedData.longitude},
        ${validatedData.accuracy || null},
        ${validatedData.altitude || null},
        ${validatedData.speed || null},
        ${validatedData.heading || null},
        ${validatedData.batteryLevel || null},
        ${validatedData.timestamp || new Date().toISOString()}
      )
    `

    // Check geofences if enabled (Premium feature)
    if (subscription.features.geofencing) {
      await checkGeofences(user.id, setting.family_id, validatedData.latitude, validatedData.longitude)
    }

    return NextResponse.json({
      success: true,
      data: { pingId },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("Location ping error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to record location" },
      { status: 500 }
    )
  }
}

async function checkGeofences(userId: string, familyId: string, latitude: number, longitude: number) {
  // Get all geofence-enabled places for this family
  const places = await sql`
    SELECT id, name, latitude, longitude, radius, alert_on_arrival, alert_on_departure
    FROM saved_places
    WHERE family_id = ${familyId} AND geofence_enabled = true
  `

  for (const place of places) {
    const distance = calculateDistance(
      latitude, longitude,
      place.latitude, place.longitude
    )
    const isInside = distance <= place.radius

    // Get last geofence event for this place/user
    const lastEvents = await sql`
      SELECT event_type FROM geofence_events
      WHERE user_id = ${userId} AND saved_place_id = ${place.id}
      ORDER BY timestamp DESC
      LIMIT 1
    `

    const wasInside = lastEvents.length > 0 && lastEvents[0].event_type === "ARRIVAL"

    // Detect arrival or departure
    if (isInside && !wasInside && place.alert_on_arrival) {
      await recordGeofenceEvent(userId, place.id, "ARRIVAL", latitude, longitude)
      await createGeofenceNotification(userId, familyId, place.name, "ARRIVAL")
    } else if (!isInside && wasInside && place.alert_on_departure) {
      await recordGeofenceEvent(userId, place.id, "DEPARTURE", latitude, longitude)
      await createGeofenceNotification(userId, familyId, place.name, "DEPARTURE")
    }
  }
}

async function recordGeofenceEvent(
  userId: string, 
  placeId: string, 
  eventType: "ARRIVAL" | "DEPARTURE",
  latitude: number,
  longitude: number
) {
  const eventId = `gfe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  await sql`
    INSERT INTO geofence_events (id, user_id, saved_place_id, event_type, latitude, longitude, timestamp)
    VALUES (${eventId}, ${userId}, ${placeId}, ${eventType}, ${latitude}, ${longitude}, NOW())
  `
}

async function createGeofenceNotification(
  userId: string,
  familyId: string,
  placeName: string,
  eventType: "ARRIVAL" | "DEPARTURE"
) {
  // Get user's name
  const users = await sql`SELECT first_name FROM users WHERE id = ${userId}`
  const userName = users[0]?.first_name || "Family member"

  // Get parents to notify
  const parents = await sql`
    SELECT user_id FROM family_members 
    WHERE family_id = ${familyId} AND role = 'PARENT' AND is_active = true AND user_id != ${userId}
  `

  for (const parent of parents) {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    await sql`
      INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
      VALUES (
        ${notifId},
        ${parent.user_id},
        'LOCATION_ALERT',
        ${eventType === "ARRIVAL" ? `${userName} arrived` : `${userName} left`},
        ${eventType === "ARRIVAL" 
          ? `${userName} has arrived at ${placeName}` 
          : `${userName} has left ${placeName}`
        },
        ${JSON.stringify({ userId, placeName, eventType })}::jsonb,
        NOW()
      )
    `
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}
