import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission, logAdminAction } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// List users with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'users.read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') // active, inactive
    
    // Build query based on filters - separate queries for different filter combinations
    const searchPattern = `%${search}%`
    
    let users
    let countResult
    
    if (search && status === 'active') {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        WHERE u.is_active = true AND (
          u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
          u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        )
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM users u
        WHERE u.is_active = true AND (
          u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
          u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        )
      `
    } else if (search && status === 'inactive') {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        WHERE u.is_active = false AND (
          u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
          u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        )
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM users u
        WHERE u.is_active = false AND (
          u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
          u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        )
      `
    } else if (search) {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        WHERE u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
              u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM users u
        WHERE u.email ILIKE ${searchPattern} OR u.first_name ILIKE ${searchPattern} OR
              u.last_name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
      `
    } else if (status === 'active') {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        WHERE u.is_active = true
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM users u WHERE u.is_active = true`
    } else if (status === 'inactive') {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        WHERE u.is_active = false
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM users u WHERE u.is_active = false`
    } else {
      users = await sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
               u.email_verified, u.created_at, u.last_login_at,
               COUNT(fm.id) as family_count
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id AND fm.is_active = true
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM users u`
    }
    
    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone,
        isActive: u.is_active,
        emailVerified: u.email_verified,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        familyCount: parseInt(u.family_count),
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult[0].total),
        totalPages: Math.ceil(parseInt(countResult[0].total) / limit),
      },
    })
  } catch (error) {
    console.error('Admin list users error:', error)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }
}
