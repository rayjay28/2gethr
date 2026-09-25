import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// List families with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'families.read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const tier = searchParams.get('tier') // FREE, PREMIUM, PREMIUM_PLUS
    
    const searchPattern = `%${search}%`
    
    let families
    let countResult
    
    if (search && tier) {
      families = await sql`
        SELECT f.id, f.name, f.invite_code, f.created_at, s.tier, s.status as subscription_status,
               s.current_period_end,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count,
               COUNT(DISTINCT cp.id) as child_count,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.id = f.owner_id) as owner_name
        FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        LEFT JOIN child_profiles cp ON fm.id = cp.family_member_id
        WHERE f.name ILIKE ${searchPattern} AND s.tier = ${tier}
        GROUP BY f.id, s.id ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(DISTINCT f.id) as total FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id
        WHERE f.name ILIKE ${searchPattern} AND s.tier = ${tier}
      `
    } else if (search) {
      families = await sql`
        SELECT f.id, f.name, f.invite_code, f.created_at, s.tier, s.status as subscription_status,
               s.current_period_end,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count,
               COUNT(DISTINCT cp.id) as child_count,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.id = f.owner_id) as owner_name
        FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        LEFT JOIN child_profiles cp ON fm.id = cp.family_member_id
        WHERE f.name ILIKE ${searchPattern}
        GROUP BY f.id, s.id ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(DISTINCT f.id) as total FROM families f WHERE f.name ILIKE ${searchPattern}
      `
    } else if (tier) {
      families = await sql`
        SELECT f.id, f.name, f.invite_code, f.created_at, s.tier, s.status as subscription_status,
               s.current_period_end,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count,
               COUNT(DISTINCT cp.id) as child_count,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.id = f.owner_id) as owner_name
        FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        LEFT JOIN child_profiles cp ON fm.id = cp.family_member_id
        WHERE s.tier = ${tier}
        GROUP BY f.id, s.id ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(DISTINCT f.id) as total FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id WHERE s.tier = ${tier}
      `
    } else {
      families = await sql`
        SELECT f.id, f.name, f.invite_code, f.created_at, s.tier, s.status as subscription_status,
               s.current_period_end,
               COUNT(DISTINCT fm.id) FILTER (WHERE fm.is_active = true) as member_count,
               COUNT(DISTINCT cp.id) as child_count,
               (SELECT u.email FROM users u WHERE u.id = f.owner_id) as owner_email,
               (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.id = f.owner_id) as owner_name
        FROM families f
        LEFT JOIN subscriptions s ON f.id = s.family_id
        LEFT JOIN family_members fm ON f.id = fm.family_id
        LEFT JOIN child_profiles cp ON fm.id = cp.family_member_id
        GROUP BY f.id, s.id ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM families f`
    }
    
    return NextResponse.json({
      families: families.map(f => ({
        id: f.id,
        name: f.name,
        inviteCode: f.invite_code,
        createdAt: f.created_at,
        subscriptionTier: f.tier || 'FREE',
        subscriptionStatus: f.subscription_status,
        currentPeriodEnd: f.current_period_end,
        memberCount: parseInt(f.member_count),
        childCount: parseInt(f.child_count),
        ownerEmail: f.owner_email,
        ownerName: f.owner_name,
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult[0].total),
        totalPages: Math.ceil(parseInt(countResult[0].total) / limit),
      },
    })
  } catch (error) {
    console.error('Admin list families error:', error)
    return NextResponse.json({ error: 'Failed to list families' }, { status: 500 })
  }
}
