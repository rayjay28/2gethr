import { NextResponse } from 'next/server'
import { getAdminFromToken } from '@/lib/admin-auth'

// SECURITY FIX (kept): this debug endpoint was publicly accessible with no
// auth and echoed back secret values to anyone who requested the URL. It
// still requires an authenticated admin and only reports booleans, never
// any part of a secret.
//
// CORRECTNESS FIX: this app does not use Firebase for push (see
// lib/services/push.ts) - it was switched to the standard Web Push
// protocol (VAPID keys), so checking FIREBASE_PROJECT_ID/CLIENT_EMAIL/
// PRIVATE_KEY here was checking variables nothing reads anymore and would
// always report "not configured" regardless of whether push actually
// works. Reports the VAPID variables push.ts actually checks instead.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const admin = token ? await getAdminFromToken(token) : null

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY_SET: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    VAPID_PRIVATE_KEY_SET: Boolean(process.env.VAPID_PRIVATE_KEY),
    VAPID_SUBJECT_SET: Boolean(process.env.VAPID_SUBJECT),
    timestamp: new Date().toISOString(),
  })
}
