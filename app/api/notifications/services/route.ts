import { NextResponse } from 'next/server'
import { getNotificationServicesStatus } from '@/lib/services/notification-dispatcher'

export async function GET() {
  try {
    const status = getNotificationServicesStatus()

    return NextResponse.json({
      services: {
        sms: {
          name: 'Twilio SMS',
          configured: status.sms,
          description: 'Send SMS text messages to users',
        },
        email: {
          name: 'Resend Email',
          configured: status.email,
          description: 'Send email notifications to users',
        },
        push: {
          name: 'Web Push',
          configured: status.push,
          description: 'Send push notifications to browsers and mobile devices',
        },
      },
      allConfigured: status.sms && status.email && status.push,
    })
  } catch (error) {
    console.error('Services status error:', error)
    return NextResponse.json(
      { error: 'Failed to get services status' },
      { status: 500 }
    )
  }
}
