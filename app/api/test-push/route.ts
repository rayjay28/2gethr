import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminFromToken } from '@/lib/admin-auth'

// Initialize Firebase Admin
import admin from 'firebase-admin'

// SECURITY FIX: this file previously contained a live Firebase service-account
// private key hardcoded in source ("temporarily, due to env var caching
// issues"). That key must be treated as compromised — rotate/revoke it in the
// Firebase console (IAM & Admin > Service Accounts) immediately, then supply
// the new key only via the FIREBASE_PRIVATE_KEY environment variable.
// This route also had no authentication at all: GET leaked every user's
// email/name/device list, and POST could push a notification to any or all
// users. Both now require a logged-in admin.
function formatPrivateKey(key: string): string {
  // Strip any wrapping/stray double quotes that survived from a .env file,
  // then turn literal "\n" sequences into real newlines.
  let formattedKey = key.replace(/^"|"$/g, '').replace(/"/g, '')
  formattedKey = formattedKey.replace(/\\n/g, '\n')

  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error(
      'Invalid FIREBASE_PRIVATE_KEY format. The key must start with "-----BEGIN PRIVATE KEY-----". ' +
      'Please copy the entire private_key value from your Firebase service account JSON file.'
    )
  }

  return formattedKey
}

function getFirebaseApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, ' +
      'and FIREBASE_PRIVATE_KEY in the environment.'
    )
  }

  const privateKey = formatPrivateKey(rawKey)

  if (admin.apps.length > 0) {
    admin.apps.forEach(app => app?.delete())
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token ? getAdminFromToken(token) : null
}

export async function GET(request: Request) {
  const requestingAdmin = await requireAdmin(request)
  if (!requestingAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Check Firebase config
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    const configStatus = {
      FIREBASE_PROJECT_ID: projectId ? `✓ ${projectId}` : '✗ Missing',
      FIREBASE_CLIENT_EMAIL: clientEmail ? `✓ ${clientEmail.substring(0, 20)}...` : '✗ Missing',
      FIREBASE_PRIVATE_KEY: privateKey ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? '✓ Set' : '✗ Missing',
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? '✓ Set' : '✗ Missing',
    }

    // Check for registered push subscriptions
    const subscriptions = await sql`
      SELECT ps.*, u.email, u.first_name
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.is_active = true
      LIMIT 5
    `

    // Try to initialize Firebase
    let firebaseStatus = 'Not initialized'
    try {
      getFirebaseApp()
      firebaseStatus = '✓ Initialized successfully'
    } catch (error) {
      firebaseStatus = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return NextResponse.json({
      success: true,
      config: configStatus,
      firebaseStatus,
      registeredDevices: subscriptions.length,
      devices: subscriptions.map(s => ({
        userId: s.user_id,
        email: s.email,
        name: s.first_name,
        platform: s.platform || 'web',
        createdAt: s.created_at
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const requestingAdmin = await requireAdmin(request)
  if (!requestingAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Get Firebase app
    const app = getFirebaseApp()
    const messaging = admin.messaging(app)

    // Parse request body for specific emails
    let targetEmails: string[] = []
    try {
      const body = await request.json()
      if (body.emails && Array.isArray(body.emails)) {
        targetEmails = body.emails
      }
    } catch {
      // No body or invalid JSON - send to all
    }

    // Get active push subscriptions, optionally filtered by email
    const subscriptions = targetEmails.length > 0
      ? await sql`
          SELECT ps.*, u.email, u.first_name
          FROM push_subscriptions ps
          JOIN users u ON ps.user_id::text = u.id::text
          WHERE ps.is_active = true
          AND u.email = ANY(${targetEmails}::text[])
        `
      : await sql`
          SELECT ps.*, u.email, u.first_name
          FROM push_subscriptions ps
          JOIN users u ON ps.user_id::text = u.id::text
          WHERE ps.is_active = true
        `

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No registered devices found. Please enable push notifications in Settings > Notifications first.'
      })
    }

    const results = []

    for (const sub of subscriptions) {
      try {
        // Send test notification
        const message = {
          token: sub.fcm_token || sub.token,
          notification: {
            title: 'Togethr Test Notification',
            body: `Hello ${sub.first_name || 'there'}! Push notifications are working correctly.`,
          },
          data: {
            type: 'TEST',
            timestamp: new Date().toISOString(),
          },
          webpush: {
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              vibrate: [200, 100, 200],
            },
          },
        }

        const response = await messaging.send(message)
        results.push({
          email: sub.email,
          status: 'sent',
          messageId: response
        })
      } catch (error) {
        results.push({
          email: sub.email,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalDevices: subscriptions.length,
      results
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
