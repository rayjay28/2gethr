import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import {
  verifyRefreshToken,
  generateTokenPair,
  getUserWithFamily,
} from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("refresh_token")?.value

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token provided" },
        { status: 401 }
      )
    }

    // Verify JWT
    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid refresh token" },
        { status: 401 }
      )
    }

    // Verify token exists in database and is not revoked
    const tokens = await sql`
      SELECT id FROM refresh_tokens 
      WHERE user_id = ${payload.userId} 
      AND token = ${refreshToken}
      AND revoked_at IS NULL 
      AND expires_at > NOW()
    `

    if (tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: "Refresh token expired or revoked" },
        { status: 401 }
      )
    }

    // Revoke old refresh token
    await sql`
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE token = ${refreshToken}
    `

    // Generate new tokens
    const newTokens = await generateTokenPair(payload.userId)

    // Get user data
    const user = await getUserWithFamily(payload.userId)

    // Create response and set cookies directly on it
    const response = NextResponse.json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken: newTokens.accessToken,
          expiresIn: 15 * 60,
        },
      },
    })

    // Set cookies on response object (required for API routes)
    // Use secure: true and sameSite: 'none' for production, 'lax' for dev
    const isProduction = process.env.NODE_ENV === "production"
    response.cookies.set("access_token", newTokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    })
    response.cookies.set("refresh_token", newTokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Token refresh error:", error)
    return NextResponse.json(
      { success: false, error: "Token refresh failed" },
      { status: 500 }
    )
  }
}
