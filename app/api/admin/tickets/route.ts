import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission, logAdminAction } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// Generate ticket number
function generateTicketNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `TKT-${year}-${random}`
}

// List support tickets
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'support.read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    
    // Fetch tickets - use separate queries for each filter combination
    let ticketRows
    let countRows
    
    if (status && priority) {
      ticketRows = await sql`
        SELECT t.id, t.ticket_number, t.category, t.priority, t.status, t.subject,
               t.user_id, t.family_id, t.assigned_admin_id,
               t.first_response_at, t.resolved_at, t.created_at, t.updated_at,
               u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
               f.name as family_name, aa.email as assigned_admin_email
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN families f ON t.family_id = f.id
        LEFT JOIN admin_users aa ON t.assigned_admin_id = aa.id
        WHERE t.status = ${status} AND t.priority = ${priority}
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*)::int as total FROM support_tickets WHERE status = ${status} AND priority = ${priority}`
    } else if (status) {
      ticketRows = await sql`
        SELECT t.id, t.ticket_number, t.category, t.priority, t.status, t.subject,
               t.user_id, t.family_id, t.assigned_admin_id,
               t.first_response_at, t.resolved_at, t.created_at, t.updated_at,
               u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
               f.name as family_name, aa.email as assigned_admin_email
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN families f ON t.family_id = f.id
        LEFT JOIN admin_users aa ON t.assigned_admin_id = aa.id
        WHERE t.status = ${status}
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*)::int as total FROM support_tickets WHERE status = ${status}`
    } else if (priority) {
      ticketRows = await sql`
        SELECT t.id, t.ticket_number, t.category, t.priority, t.status, t.subject,
               t.user_id, t.family_id, t.assigned_admin_id,
               t.first_response_at, t.resolved_at, t.created_at, t.updated_at,
               u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
               f.name as family_name, aa.email as assigned_admin_email
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN families f ON t.family_id = f.id
        LEFT JOIN admin_users aa ON t.assigned_admin_id = aa.id
        WHERE t.priority = ${priority}
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*)::int as total FROM support_tickets WHERE priority = ${priority}`
    } else {
      ticketRows = await sql`
        SELECT t.id, t.ticket_number, t.category, t.priority, t.status, t.subject,
               t.user_id, t.family_id, t.assigned_admin_id,
               t.first_response_at, t.resolved_at, t.created_at, t.updated_at,
               u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
               f.name as family_name, aa.email as assigned_admin_email
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN families f ON t.family_id = f.id
        LEFT JOIN admin_users aa ON t.assigned_admin_id = aa.id
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*)::int as total FROM support_tickets`
    }
    
    const total = countRows[0]?.total || 0
    
    // Get status counts
    const statusCountRows = await sql`
      SELECT status, COUNT(*)::int as count
      FROM support_tickets
      GROUP BY status
    `
    
    return NextResponse.json({
      tickets: ticketRows.map(t => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        user: t.user_id ? {
          id: t.user_id,
          email: t.user_email,
          name: `${t.user_first_name || ''} ${t.user_last_name || ''}`.trim(),
        } : null,
        family: t.family_id ? {
          id: t.family_id,
          name: t.family_name,
        } : null,
        assignedAdmin: t.assigned_admin_id ? {
          id: t.assigned_admin_id,
          email: t.assigned_admin_email,
        } : null,
        firstResponseAt: t.first_response_at,
        resolvedAt: t.resolved_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: statusCountRows.reduce((acc, s) => {
        acc[s.status] = s.count
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error('Admin list tickets error:', error)
    return NextResponse.json({ error: 'Failed to list tickets' }, { status: 500 })
  }
}

// Create ticket
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'support.update')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { userId, familyId, category, priority, subject, description } = body
    
    if (!category || !subject) {
      return NextResponse.json({ error: 'Category and subject required' }, { status: 400 })
    }
    
    const ticketNumber = generateTicketNumber()
    
    const result = await sql`
      INSERT INTO support_tickets (
        ticket_number, family_id, user_id, category, priority, subject, description,
        assigned_admin_id
      ) VALUES (
        ${ticketNumber},
        ${familyId || null},
        ${userId || null},
        ${category},
        ${priority || 'NORMAL'},
        ${subject},
        ${description || null},
        ${admin.id}
      )
      RETURNING id, ticket_number
    `
    
    await logAdminAction(
      admin.id,
      'CREATE_TICKET',
      'ticket',
      result[0].id,
      { ticketNumber, category, priority },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    )
    
    return NextResponse.json({
      ticket: {
        id: result[0].id,
        ticketNumber: result[0].ticket_number,
      },
    })
  } catch (error) {
    console.error('Admin create ticket error:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
