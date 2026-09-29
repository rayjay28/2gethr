import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

// DELETE - Revoke a single session (refresh token) belonging to the current
// user. Revoking the session the request itself is using is allowed — the
// caller gets `wasCurrent: true` back and is expected to clear its local
// tokens and redirect to login, since the refresh token that would have
// kept it signed in no longer works.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    const cookieStore = await cookies()
    const currentRefreshToken = cookieStore.get("refresh_token")?.value

    const rows = await sql`
      SELECT id, token FROM refresh_tokens
      WHERE id = ${sessionId} AND user_id = ${user.id} AND revoked_at IS NULL
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const wasCurrent = !!currentRefreshToken && rows[0].token === currentRefreshToken

    await sql`
      UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ${sessionId}
    `

    return NextResponse.json({ success: true, wasCurrent })
  } catch (error) {
    console.error("Session revoke error:", error)
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 })
  }
}
