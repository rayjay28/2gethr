import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { nanoid } from 'nanoid'

// POST - Create an upgrade request
export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { familyId, tier, billingCycle, paymentMethod } = body

    if (!familyId || !tier || !billingCycle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user is in family
    const membership = await sql`
      SELECT fm.*, f.name as family_name
      FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE fm.family_id = ${familyId} AND fm.user_id = ${user.id}
    `

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Not a member of this family' }, { status: 403 })
    }

    // Only owners can upgrade
    if (membership[0].role !== 'owner') {
      return NextResponse.json({ error: 'Only family owners can manage subscriptions' }, { status: 403 })
    }

    // Get or create subscription
    let subscription = await sql`
      SELECT * FROM subscriptions WHERE family_id = ${familyId}
    `

    if (subscription.length === 0) {
      // Create new subscription with pending status
      subscription = await sql`
        INSERT INTO subscriptions (
          id, family_id, tier, status, created_at, updated_at
        ) VALUES (
          ${nanoid()}, ${familyId}, 'FREE', 'ACTIVE', NOW(), NOW()
        )
        RETURNING *
      `
    }

    // Calculate price based on tier and billing cycle
    const prices: Record<string, { monthly: number; annual: number }> = {
      PREMIUM: { monthly: 999, annual: 9990 }, // in cents
      PREMIUM_PLUS: { monthly: 1999, annual: 19990 }
    }

    const price = prices[tier.toUpperCase()]
    if (!price) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const amount = billingCycle === 'annual' ? price.annual : price.monthly

    // Create a pending payment transaction for admin processing
    const transaction = await sql`
      INSERT INTO payment_transactions (
        id, subscription_id, amount, currency, status, description, metadata, created_at
      ) VALUES (
        ${nanoid()}, ${subscription[0].id}, ${amount}, 'usd', 'PENDING',
        ${`Upgrade to ${tier} (${billingCycle})`},
        ${JSON.stringify({
          requestedTier: tier.toUpperCase(),
          billingCycle,
          paymentMethod: paymentMethod || 'pending',
          requestedBy: user.id,
          requestedAt: new Date().toISOString(),
          familyName: membership[0].family_name
        })}::jsonb,
        NOW()
      )
      RETURNING *
    `

    // Log the subscription status change request
    await sql`
      INSERT INTO subscription_status_history (
        id, subscription_id, old_status, new_status, source, notes, changed_at
      ) VALUES (
        gen_random_uuid(), ${subscription[0].id}, ${subscription[0].tier}, ${tier.toUpperCase()},
        'USER_REQUEST', ${`User requested upgrade to ${tier} (${billingCycle})`}, NOW()
      )
    `

    return NextResponse.json({
      success: true,
      transactionId: transaction[0].id,
      message: 'Upgrade request submitted. Your request is pending payment processing.',
      amount: amount / 100,
      currency: 'USD'
    })
  } catch (error) {
    console.error('Upgrade request error:', error)
    return NextResponse.json({ error: 'Failed to create upgrade request' }, { status: 500 })
  }
}

// GET - Get pending upgrade requests for the user
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    if (!familyId) {
      return NextResponse.json({ error: 'familyId required' }, { status: 400 })
    }

    // Get pending transactions for this family's subscription
    const transactions = await sql`
      SELECT pt.*, s.tier as current_tier
      FROM payment_transactions pt
      JOIN subscriptions s ON s.id = pt.subscription_id
      WHERE s.family_id = ${familyId} AND pt.status = 'PENDING'
      ORDER BY pt.created_at DESC
    `

    return NextResponse.json({ data: transactions })
  } catch (error) {
    console.error('Get upgrade requests error:', error)
    return NextResponse.json({ error: 'Failed to get upgrade requests' }, { status: 500 })
  }
}
