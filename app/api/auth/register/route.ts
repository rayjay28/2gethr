import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  hashPassword,
  generateTokenPair,
  logAuditEvent,
} from "@/lib/auth"
import { z } from "zod"
import { notifyAdmin, EMAIL_TEMPLATES } from "@/lib/services/email"

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number"
    ),
  // Support both displayName (from UI) or firstName/lastName
  displayName: z.string().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().optional(),
  timezone: z.string().default("UTC"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // SECURITY FIX: this used to log the raw request body, including the
    // user's plaintext password, to server logs.
    const validatedData = registerSchema.parse(body)

    // Check if email already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${validatedData.email.toLowerCase()}
    `

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)

    // Handle name - support displayName or firstName/lastName
    let firstName = validatedData.firstName || ''
    let lastName = validatedData.lastName || ''
    
    if (validatedData.displayName && !firstName) {
      const parts = validatedData.displayName.trim().split(' ')
      firstName = parts[0] || ''
      lastName = parts.slice(1).join(' ') || ''
    }
    
    // Default if still empty
    if (!firstName) firstName = 'User'

    // Create user
    const userId = crypto.randomUUID()
    await sql`
      INSERT INTO users (
        id, email, password_hash, first_name, last_name,
        phone, timezone, is_active, created_at, updated_at
      )
      VALUES (
        ${userId},
        ${validatedData.email.toLowerCase()},
        ${passwordHash},
        ${firstName},
        ${lastName},
        ${validatedData.phone || null},
        ${validatedData.timezone},
        true,
        NOW(),
        NOW()
      )
    `

    // Create default reminder settings
    await sql`
      INSERT INTO reminder_settings (
        id, user_id, push_enabled, email_enabled, 
        default_reminder_minutes, created_at, updated_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        true,
        true,
        ${[15, 60]},
        NOW(),
        NOW()
      )
    `

    // Notify admin of the new signup. Awaited (not fire-and-forget): on
    // Vercel's serverless runtime, an un-awaited promise can get cut off
    // once the response is returned. notifyAdmin() itself never throws, so
    // this can't fail or meaningfully slow down the user's registration.
    const signupNotice = EMAIL_TEMPLATES.ADMIN_NEW_SIGNUP(
      validatedData.email.toLowerCase(),
      `${firstName} ${lastName}`.trim()
    )
    await notifyAdmin(signupNotice.subject, signupNotice.html, signupNotice.text)

    // Generate tokens
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined
    const tokens = await generateTokenPair(userId, { ipAddress, userAgent })

    // Audit log
    await logAuditEvent(userId, "CREATE", "user", userId, {
      newValue: { email: validatedData.email, firstName: validatedData.firstName },
      ipAddress,
      userAgent,
    })

    // Create response - include tokens for localStorage-based auth
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: validatedData.email.toLowerCase(),
          firstName,
          lastName,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 15 * 60,
        },
      },
      message: "Registration successful",
    })

    // Set cookies on response object (required for API routes)
    // Use secure: true and sameSite: 'none' for production, 'lax' for dev
    const isProduction = process.env.NODE_ENV === "production"
    response.cookies.set("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    })
    response.cookies.set("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("[v0] Registration error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    )
  }
}
