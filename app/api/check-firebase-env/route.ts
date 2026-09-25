import { NextResponse } from 'next/server'
import { getAdminFromToken } from '@/lib/admin-auth'

// SECURITY FIX: this debug endpoint was publicly accessible with no auth and
// echoed back the Firebase project id, client email, and a preview + length
// of the private key to anyone who requested the URL. It now requires an
// authenticated admin and only reports booleans (configured/not configured),
// never any part of the secret values. Recommend removing this route
// entirely before shipping if it's no longer needed for setup diagnostics.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const admin = token ? await getAdminFromToken(token) : null

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    FIREBASE_PROJECT_ID_SET: Boolean(process.env.FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL_SET: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_PRIVATE_KEY_SET: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    FIREBASE_PRIVATE_KEY_LOOKS_VALID:
      !!process.env.FIREBASE_PRIVATE_KEY?.includes('-----BEGIN'),
    timestamp: new Date().toISOString(),
  })
}
