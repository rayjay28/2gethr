import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// Admin subscriptions management API - List with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'subscriptions.read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const tier = searchParams.get('tier')
    const status = searchParams.get('status')
    
    let subscriptions
    let countResult
    
    if (tier && status) {
      subscriptions = await sql`
        SELECT s.*, f.name as family_name,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count
        FROM subscriptions s
        JOIN families f ON s.family_id = f.id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        WHERE s.tier = ${tier} AND s.status = ${status}
        GROUP BY s.id, f.id ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM subscriptions s WHERE s.tier = ${tier} AND s.status = ${status}`
    } else if (tier) {
      subscriptions = await sql`
        SELECT s.*, f.name as family_name,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count
        FROM subscriptions s
        JOIN families f ON s.family_id = f.id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        WHERE s.tier = ${tier}
        GROUP BY s.id, f.id ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM subscriptions s WHERE s.tier = ${tier}`
    } else if (status) {
      subscriptions = await sql`
        SELECT s.*, f.name as family_name,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count
        FROM subscriptions s
        JOIN families f ON s.family_id = f.id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        WHERE s.status = ${status}
        GROUP BY s.id, f.id ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM subscriptions s WHERE s.status = ${status}`
    } else {
      subscriptions = await sql`
        SELECT s.*, f.name as family_name,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count
        FROM subscriptions s
        JOIN families f ON s.family_id = f.id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        GROUP BY s.id, f.id ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM subscriptions s`
    }
    
    // Get tier stats
    const tierStats = await sql`
      SELECT tier, COUNT(*) as count
      FROM subscriptions
      WHERE status = 'ACTIVE'
      GROUP BY tier
    `
    
    return NextResponse.json({
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        familyId: s.family_id,
        familyName: s.family_name,
        ownerEmail: s.owner_email,
        tier: s.tier,
        status: s.status,
        memberCount: parseInt(s.member_count),
        currentPeriodStart: s.current_period_start,
        currentPeriodEnd: s.current_period_end,
        trialEndsAt: s.trial_ends_at,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        createdAt: s.created_at,
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult[0].total),
        totalPages: Math.ceil(parseInt(countResult[0].total) / limit),
      },
      stats: {
        byTier: tierStats.reduce((acc, t) => {
          acc[t.tier] = parseInt(t.count)
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error) {
    console.error('Admin list subscriptions error:', error)
    return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: 500 })
  }
}
