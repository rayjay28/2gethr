import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { isTwoFactorEnabled } from "@/lib/services/two-factor"

// Whether the logged-in user currently has 2FA enabled — used by the
// settings page to decide whether to show "Enable 2FA" or "Disable 2FA".
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const enabled = await isTwoFactorEnabled(user.id)
  return NextResponse.json({ success: true, data: { enabled } })
}
