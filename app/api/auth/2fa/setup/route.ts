import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { startEnrollment } from "@/lib/services/two-factor"

// Starts (or restarts) 2FA enrollment for the logged-in user. Returns a QR
// code image URL plus the manual-entry secret; the user must then submit a
// code from their authenticator app to /api/auth/2fa/enable to actually
// turn 2FA on. Calling this again before confirming just replaces the
// pending secret — safe to retry if the QR didn't scan.
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await startEnrollment(user.id, user.email)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json({ success: false, error: "Failed to start 2FA setup" }, { status: 500 })
  }
}
