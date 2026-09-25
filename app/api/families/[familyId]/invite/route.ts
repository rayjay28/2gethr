import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest, logAuditEvent } from "@/lib/auth"

// Generate new invite code (owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    // Verify ownership
    const families = await sql`
      SELECT owner_id FROM families WHERE id = ${familyId}
    `

    if (families.length === 0) {
      return NextResponse.json(
        { success: false, error: "Family not found" },
        { status: 404 }
      )
    }

    if (families[0].owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Only the family owner can generate invite codes" },
        { status: 403 }
      )
    }

    const newInviteCode = generateInviteCode()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await sql`
      UPDATE families 
      SET invite_code = ${newInviteCode}, invite_expires_at = ${expiresAt.toISOString()}, updated_at = NOW()
      WHERE id = ${familyId}
    `

    // Audit log
    await logAuditEvent(user.id, "UPDATE", "family_invite", familyId, {
      newValue: { inviteCode: newInviteCode, expiresAt },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        inviteCode: newInviteCode,
        expiresAt,
      },
      message: "New invite code generated",
    })
  } catch (error) {
    console.error("Generate invite error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate invite code" },
      { status: 500 }
    )
  }
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
