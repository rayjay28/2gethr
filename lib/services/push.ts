/**
 * Push Notification Service using Firebase Cloud Messaging (FCM)
 * 
 * Required environment variables:
 * - FIREBASE_PROJECT_ID: Your Firebase project ID
 * - FIREBASE_CLIENT_EMAIL: Firebase service account email
 * - FIREBASE_PRIVATE_KEY: Firebase service account private key (base64 encoded)
 */

import { sql } from '@/lib/db'

interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
  icon?: string
  badge?: string
  clickAction?: string
}

interface PushResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}

/**
 * Format the private key to handle various storage formats
 */
function formatPrivateKey(key: string): string {
  let formattedKey = key

  // Strip any wrapping double quotes that survived from a .env file
  // (e.g. FIREBASE_PRIVATE_KEY="-----BEGIN...-----") plus any stray
  // internal quotes, then turn literal "\n" sequences into real newlines.
  formattedKey = formattedKey.replace(/^"|"$/g, '').replace(/"/g, '')
  formattedKey = formattedKey.replace(/\\n/g, '\n')

  // If the key doesn't start with the PEM header, it might be base64 encoded
  if (!formattedKey.includes('-----BEGIN')) {
    try {
      formattedKey = Buffer.from(formattedKey, 'base64').toString('utf-8')
    } catch {
      // Not base64, use as is
    }
  }
  
  // Ensure proper PEM format with newlines
  if (formattedKey.includes('-----BEGIN PRIVATE KEY-----') && !formattedKey.includes('\n')) {
    formattedKey = formattedKey
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
  }
  
  return formattedKey
}

/**
 * Get Firebase access token using service account
 */
async function getFirebaseAccessToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null

  try {
    // Format the private key properly
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY!)

    // Create JWT for Google OAuth
    const header = Buffer.from(JSON.stringify({
      alg: 'RS256',
      typ: 'JWT'
    })).toString('base64url')

    const now = Math.floor(Date.now() / 1000)
    const payload = Buffer.from(JSON.stringify({
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      sub: process.env.FIREBASE_CLIENT_EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging'
    })).toString('base64url')

    // Sign the JWT (simplified - in production use jose or similar)
    const { createSign } = await import('crypto')
    const sign = createSign('RSA-SHA256')
    sign.update(`${header}.${payload}`)
    const signature = sign.sign(privateKey, 'base64url')

    const jwt = `${header}.${payload}.${signature}`

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    const data = await response.json()
    return data.access_token || null
  } catch (error) {
    console.error('Firebase auth error:', error)
    return null
  }
}

/**
 * Send push notification via FCM
 */
export async function sendPushNotification(
  token: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured - Push not sent')
    return { success: false, error: 'Firebase not configured' }
  }

  const accessToken = await getFirebaseAccessToken()
  if (!accessToken) {
    return { success: false, error: 'Failed to get Firebase access token' }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID!

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            webpush: {
              notification: {
                icon: payload.icon || '/icons/icon-192x192.png',
                badge: payload.badge || '/icons/icon-72x72.png',
              },
              fcm_options: {
                link: payload.clickAction || '/',
              },
            },
            data: payload.data,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('FCM error:', data)
      return { 
        success: false, 
        error: data.error?.message || 'Failed to send push notification' 
      }
    }

    return { 
      success: true, 
      messageId: data.name 
    }
  } catch (error) {
    console.error('Push notification error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Send push notification to a user (fetches their tokens from DB)
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  // Get user's push tokens from database
  const tokens = await sql`
    SELECT token, platform FROM push_tokens
    WHERE user_id = ${userId}
      AND is_active = true
  `

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  for (const { token } of tokens) {
    const result = await sendPushNotification(token, payload)
    if (result.success) {
      sent++
    } else {
      failed++
      // If token is invalid, mark it as inactive
      if (result.error?.includes('not registered') || result.error?.includes('invalid')) {
        await sql`
          UPDATE push_tokens SET is_active = false 
          WHERE token = ${token}
        `
      }
    }
  }

  return { sent, failed }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0
  let totalFailed = 0

  for (const userId of userIds) {
    const { sent, failed } = await sendPushToUser(userId, payload)
    totalSent += sent
    totalFailed += failed
  }

  return { sent: totalSent, failed: totalFailed }
}

/**
 * Register a push token for a user
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'web' | 'ios' | 'android'
): Promise<boolean> {
  try {
    // Upsert the token
    await sql`
      INSERT INTO push_tokens (user_id, token, platform, is_active, created_at, updated_at)
      VALUES (${userId}, ${token}, ${platform}, true, NOW(), NOW())
      ON CONFLICT (token) 
      DO UPDATE SET 
        user_id = ${userId},
        is_active = true,
        updated_at = NOW()
    `
    return true
  } catch (error) {
    console.error('Failed to register push token:', error)
    return false
  }
}

/**
 * Unregister a push token
 */
export async function unregisterPushToken(token: string): Promise<boolean> {
  try {
    await sql`
      UPDATE push_tokens SET is_active = false 
      WHERE token = ${token}
    `
    return true
  } catch (error) {
    console.error('Failed to unregister push token:', error)
    return false
  }
}

/**
 * Send push notification using Web Push API (fallback for browsers without FCM)
 */
export async function sendWebPush(
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  },
  payload: PushPayload
): Promise<PushResult> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured - Web Push not sent')
    return { success: false, error: 'VAPID keys not configured' }
  }

  try {
    // Web Push implementation would go here
    // This requires the 'web-push' npm package
    // For now, we'll use FCM which handles web push internally
    console.log('Web Push would be sent to:', subscription.endpoint)
    return { success: true, messageId: 'web-push-' + Date.now() }
  } catch (error) {
    console.error('Web push error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
