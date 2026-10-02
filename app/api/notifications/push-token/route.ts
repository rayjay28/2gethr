import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { registerPushToken, unregisterPushToken } from '@/lib/services/push'

export async function POST(request: Request) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    if (!accessToken) {
      const cookieStore = await cookies()
      accessToken = cookieStore.get('access_token')?.value
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyAccessToken(accessToken)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { token, platform, deviceInfo } = body

    if (!token || !platform) {
      return NextResponse.json(
        { error: 'Token and platform are required' },
        { status: 400 }
      )
    }

    if (!['web', 'ios', 'android'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be web, ios, or android' },
        { status: 400 }
      )
    }

    // REBUILD FIX: the client (hooks/use-push-notifications.ts) always sends
    // platform: 'web' (it has no reliable way to tell desktop vs mobile
    // apart from inside a PushManager callback) plus a deviceInfo object
    // with the real userAgent - but this route only ever destructured
    // {token, platform} and dropped deviceInfo entirely, so every row in
    // push_tokens ended up with device_info = {} and platform = 'web'
    // regardless of device. That made every "which device is this" question
    // (exactly what came up diagnosing this user's Android delivery issue)
    // require manually reading the push subscription's endpoint hostname out
    // of raw JSON in the database. Derive a real platform from the request's
    // own User-Agent header (authoritative - not spoofable by client JS the
    // way a body field would be) and persist deviceInfo so this is visible
    // going forward.
    const userAgent = request.headers.get('user-agent') || ''
    const detectedPlatform: 'web' | 'ios' | 'android' = /android/i.test(userAgent)
      ? 'android'
      : /iphone|ipad|ipod/i.test(userAgent)
        ? 'ios'
        : (platform as 'web' | 'ios' | 'android')

    const success = await registerPushToken(payload.userId, token, detectedPlatform, {
      ...(deviceInfo && typeof deviceInfo === 'object' ? deviceInfo : {}),
      userAgent,
    })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to register push token' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push token registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    // SECURITY FIX: this previously had no auth check at all — anyone who
    // knew or guessed a token value could unregister another user's device.
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    if (!accessToken) {
      const cookieStore = await cookies()
      accessToken = cookieStore.get('access_token')?.value
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyAccessToken(accessToken)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const success = await unregisterPushToken(token)

    return NextResponse.json({ success })
  } catch (error) {
    console.error('Push token unregistration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
