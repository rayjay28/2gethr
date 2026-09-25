import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest, checkFamilySubscription, logAuditEvent } from "@/lib/auth"
import { z } from "zod"

const createCalendarSchema = z.object({
  name: z.string().min(1, "Calendar name is required").max(100),
  familyId: z.string().uuid("Invalid family ID"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#3B82F6"),
  isShared: z.boolean().default(true),
})

// Get user's calendars
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    // Get calendars for all families user is a member of
    const calendars = await sql`
      SELECT 
        c.id, c.name, c.color, c.is_shared, c.is_default, c.family_id, c.created_at,
        f.name as family_name,
        (SELECT COUNT(*) FROM events WHERE calendar_id = c.id AND status != 'CANCELLED') as event_count
      FROM calendars c
      JOIN families f ON c.family_id = f.id
      JOIN family_members fm ON f.id = fm.family_id
      WHERE fm.user_id = ${user.id} AND fm.is_active = true
      AND (c.is_shared = true OR fm.role = 'PARENT')
      ORDER BY c.is_default DESC, c.name ASC
    `

    return NextResponse.json({
      success: true,
      data: calendars.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        isShared: c.is_shared,
        isDefault: c.is_default,
        familyId: c.family_id,
        familyName: c.family_name,
        eventCount: Number(c.event_count),
        createdAt: c.created_at,
      })),
    })
  } catch (error) {
    console.error("Get calendars error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get calendars" },
      { status: 500 }
    )
  }
}

// Create a new calendar
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
    const { name, familyId, color, isShared } = createCalendarSchema.parse(body)

    // Verify user is a PARENT in this family
    const membership = await sql`
      SELECT role FROM family_members 
      WHERE family_id = ${familyId} AND user_id = ${user.id} AND is_active = true
    `

    if (membership.length === 0 || membership[0].role !== "PARENT") {
      return NextResponse.json(
        { success: false, error: "Only parents can create calendars" },
        { status: 403 }
      )
    }

    // Check subscription limits
    const subscription = await checkFamilySubscription(familyId)
    const calendarCount = await sql`
      SELECT COUNT(*) as count FROM calendars WHERE family_id = ${familyId}
    `

    if (Number(calendarCount[0].count) >= subscription.features.maxCalendars) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Family has reached its calendar limit (${subscription.features.maxCalendars}). Upgrade to create more calendars.` 
        },
        { status: 400 }
      )
    }

    const calendarId = crypto.randomUUID()
    await sql`
      INSERT INTO calendars (id, family_id, name, color, is_shared, is_default, created_at, updated_at)
      VALUES (${calendarId}, ${familyId}, ${name}, ${color}, ${isShared}, false, NOW(), NOW())
    `

    // Audit log
    await logAuditEvent(user.id, "CREATE", "calendar", calendarId, {
      newValue: { name, familyId, color, isShared },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: calendarId,
        name,
        color,
        isShared,
        familyId,
      },
      message: "Calendar created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("Create calendar error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create calendar" },
      { status: 500 }
    )
  }
}
