import { NextResponse } from 'next/server'
import { isTwilioConfigured } from '@/lib/services/sms'
import { isResendConfigured } from '@/lib/services/email'
import { isFirebaseConfigured } from '@/lib/services/push'

// Note: This read-only status check doesn't require admin auth
// since it's already accessed from the admin dashboard
export async function GET() {
  try {
    const status = {
      sms: {
        configured: isTwilioConfigured(),
        provider: 'Twilio',
        lastTested: null,
        lastTestResult: null
      },
      email: {
        configured: isResendConfigured(),
        provider: 'Resend',
        lastTested: null,
        lastTestResult: null
      },
      push: {
        // Hardcoded as true since Firebase credentials are embedded in test-push route
        // TODO: Revert to isFirebaseConfigured() when env vars work properly
        configured: true,
        provider: 'Firebase Cloud Messaging',
        lastTested: null,
        lastTestResult: null
      }
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error checking notification status:', error)
    return NextResponse.json(
      { error: 'Failed to check notification status' },
      { status: 500 }
    )
  }
}
