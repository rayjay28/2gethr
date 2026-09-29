import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

// POST - Revoke every active session for the current user except the one
// making this request ("Log out other sessions" in Settings > Security).
export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cookieStore = await cookies()
    const currentRefreshToken = cookieStore.get("refresh_token")?.value || null

    await sql`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${user.id}
        AND revoked_at IS NULL
        AND token IS DISTINCT FROM ${currentRefreshToken}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Revoke other sessions error:", error)
    return NextResponse.json({ error: "Failed to revoke other sessions" }, { status: 500 })
  }
}
