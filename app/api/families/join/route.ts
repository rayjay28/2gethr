import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest, checkFamilySubscription, logAuditEvent } from "@/lib/auth"
import { z } from "zod"

const joinFamilySchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
  role: z.enum(["PARENT", "GUARDIAN", "CHILD"]).default("PARENT"),
  nickname: z.string().max(50).optional(),
})

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
    const { inviteCode, role, nickname } = joinFamilySchema.parse(body)

    // Find family by invite code
    const families = await sql`
      SELECT id, name, owner_id, invite_expires_at
      FROM families 
      WHERE invite_code = ${inviteCode.toUpperCase()}
    `

    if (families.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid invite code" },
        { status: 404 }
      )
    }

    const family = families[0]

    // Check if invite code is expired
    if (family.invite_expires_at && new Date(family.invite_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Invite code has expired" },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMemberships = await sql`
      SELECT id, is_active FROM family_members 
      WHERE family_id = ${family.id} AND user_id = ${user.id}
    `

    if (existingMemberships.length > 0) {
      const membership = existingMemberships[0]
      if (membership.is_active) {
        return NextResponse.json(
          { success: false, error: "You are already a member of this family" },
          { status: 400 }
        )
      }

      // Reactivate existing membership
      await sql`
        UPDATE family_members 
        SET is_active = true, role = ${role}, nickname = ${nickname || user.firstName}, 
            joined_at = NOW(), updated_at = NOW()
        WHERE id = ${membership.id}
      `

      return NextResponse.json({
        success: true,
        data: {
          familyId: family.id,
          familyName: family.name,
          membershipId: membership.id,
          role,
        },
        message: "Rejoined family successfully",
      })
    }

    // Check subscription limits
    const subscription = await checkFamilySubscription(family.id)
    const memberCount = await sql`
      SELECT COUNT(*) as count FROM family_members 
      WHERE family_id = ${family.id} AND is_active = true
    `

    if (Number(memberCount[0].count) >= subscription.features.maxFamilyMembers) {
      return NextResponse.json(
        { 
          success: false, 
          error: `This family has reached its member limit (${subscription.features.maxFamilyMembers}). The family owner needs to upgrade their subscription.` 
        },
        { status: 400 }
      )
    }

    // Determine permissions based on role
    const permissions = getRolePermissions(role)

    const memberId = crypto.randomUUID()
    await sql`
      INSERT INTO family_members (
        id, family_id, user_id, role, nickname, is_active, joined_at,
        can_create_events, requires_event_approval, can_override_conflicts,
        can_view_family_calendar, can_invite_members, created_at, updated_at
      )
      VALUES (
        ${memberId}, ${family.id}, ${user.id}, ${role}, ${nickname || user.firstName},
        true, NOW(),
        ${permissions.canCreateEvents}, ${permissions.requiresEventApproval},
        ${permissions.canOverrideConflicts}, ${permissions.canViewFamilyCalendar},
        ${permissions.canInviteMembers}, NOW(), NOW()
      )
    `

    // If joining as CHILD, create child profile
    if (role === "CHILD") {
      await sql`
        INSERT INTO child_profiles (id, family_member_id, display_name, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${memberId}, ${nickname || user.firstName}, NOW(), NOW())
      `

      // Create default location settings for child
      await sql`
        INSERT INTO location_settings (
          id, family_member_id, mode, share_with_family, 
          update_interval_sec, created_at, updated_at
        )
        VALUES (
          ${crypto.randomUUID()}, ${memberId}, 'OFF', false, 
          300, NOW(), NOW()
        )
      `
    }

    // Audit log
    await logAuditEvent(user.id, "CREATE", "family_member", memberId, {
      newValue: { familyId: family.id, role, nickname },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        familyId: family.id,
        familyName: family.name,
        membershipId: memberId,
        role,
      },
      message: "Joined family successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("Join family error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to join family" },
      { status: 500 }
    )
  }
}

function getRolePermissions(role: string) {
  switch (role) {
    case "PARENT":
      return {
        canCreateEvents: true,
        requiresEventApproval: false,
        canOverrideConflicts: true,
        canViewFamilyCalendar: true,
        canInviteMembers: true,
      }
    case "GUARDIAN":
      return {
        canCreateEvents: true,
        requiresEventApproval: false,
        canOverrideConflicts: false,
        canViewFamilyCalendar: true,
        canInviteMembers: false,
      }
    case "CHILD":
      return {
        canCreateEvents: false,
        requiresEventApproval: true,
        canOverrideConflicts: false,
        canViewFamilyCalendar: true,
        canInviteMembers: false,
      }
    default:
      return {
        canCreateEvents: false,
        requiresEventApproval: true,
        canOverrideConflicts: false,
        canViewFamilyCalendar: true,
        canInviteMembers: false,
      }
  }
}
