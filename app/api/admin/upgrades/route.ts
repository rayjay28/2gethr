import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// GET - List all pending upgrade requests
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(admin, 'subscription:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Optional filter

    let transactions
    if (status) {
      transactions = await sql`
        SELECT pt.*, 
               s.family_id,
               f.name as family_name,
               u.email as user_email,
               u.first_name || ' ' || COALESCE(u.last_name, '') as user_name
        FROM payment_transactions pt
        JOIN subscriptions s ON s.id = pt.subscription_id
        JOIN families f ON f.id = s.family_id
        LEFT JOIN users u ON u.id = f.owner_id
        WHERE pt.status = ${status}
        ORDER BY pt.created_at DESC
      `
    } else {
      transactions = await sql`
        SELECT pt.*, 
               s.family_id,
               f.name as family_name,
               u.email as user_email,
               u.first_name || ' ' || COALESCE(u.last_name, '') as user_name
        FROM payment_transactions pt
        JOIN subscriptions s ON s.id = pt.subscription_id
        JOIN families f ON f.id = s.family_id
        LEFT JOIN users u ON u.id = f.owner_id
        ORDER BY 
          CASE WHEN pt.status = 'PENDING' THEN 0 ELSE 1 END,
          pt.created_at DESC
        LIMIT 100
      `
    }

    return NextResponse.json({ data: transactions })
  } catch (error) {
    console.error('Admin upgrades GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch upgrade requests' }, { status: 500 })
  }
}
