import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken, hasPermission, logAdminAction } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

// Get ticket details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'support.read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { ticketId } = await params
    
    const ticketResult = await sql`
      SELECT 
        t.*,
        u.id as user_id, u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
        f.id as family_id, f.name as family_name,
        aa.id as assigned_id, aa.email as assigned_email, aa.first_name as assigned_first_name,
        ea.email as escalated_email
      FROM support_tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN families f ON t.family_id = f.id
      LEFT JOIN admin_users aa ON t.assigned_admin_id = aa.id
      LEFT JOIN admin_users ea ON t.escalated_to_admin_id = ea.id
      WHERE t.id = ${ticketId}
    `
    
    if (ticketResult.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    
    const ticket = ticketResult[0]
    
    // Get messages
    const messages = await sql`
      SELECT 
        m.*,
        CASE 
          WHEN m.sender_type = 'USER' THEN u.email
          WHEN m.sender_type = 'ADMIN' THEN au.email
          ELSE 'System'
        END as sender_email,
        CASE 
          WHEN m.sender_type = 'USER' THEN u.first_name || ' ' || u.last_name
          WHEN m.sender_type = 'ADMIN' THEN au.first_name || ' ' || au.last_name
          ELSE 'System'
        END as sender_name
      FROM support_ticket_messages m
      LEFT JOIN users u ON m.sender_type = 'USER' AND m.sender_id::text = u.id
      LEFT JOIN admin_users au ON m.sender_type = 'ADMIN' AND m.sender_id = au.id
      WHERE m.ticket_id = ${ticketId}
      ORDER BY m.created_at ASC
    `
    
    // Get actions history
    const actions = await sql`
      SELECT a.*, au.email as admin_email
      FROM support_ticket_actions a
      LEFT JOIN admin_users au ON a.admin_user_id = au.id
      WHERE a.ticket_id = ${ticketId}
      ORDER BY a.created_at DESC
    `
    
    return NextResponse.json({
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        subject: ticket.subject,
        description: ticket.description,
        user: ticket.user_id ? {
          id: ticket.user_id,
          email: ticket.user_email,
          name: `${ticket.user_first_name} ${ticket.user_last_name}`,
        } : null,
        family: ticket.family_id ? {
          id: ticket.family_id,
          name: ticket.family_name,
        } : null,
        assignedAdmin: ticket.assigned_id ? {
          id: ticket.assigned_id,
          email: ticket.assigned_email,
          name: ticket.assigned_first_name,
        } : null,
        escalatedToEmail: ticket.escalated_email,
        resolutionNotes: ticket.resolution_notes,
        firstResponseAt: ticket.first_response_at,
        resolvedAt: ticket.resolved_at,
        closedAt: ticket.closed_at,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      },
      messages: messages.map(m => ({
        id: m.id,
        senderType: m.sender_type,
        senderEmail: m.sender_email,
        senderName: m.sender_name,
        message: m.message,
        isInternalNote: m.is_internal_note,
        attachments: m.attachments,
        createdAt: m.created_at,
      })),
      actions: actions.map(a => ({
        id: a.id,
        actionType: a.action_type,
        adminEmail: a.admin_email,
        oldValue: a.old_value,
        newValue: a.new_value,
        createdAt: a.created_at,
      })),
    })
  } catch (error) {
    console.error('Admin get ticket error:', error)
    return NextResponse.json({ error: 'Failed to get ticket' }, { status: 500 })
  }
}

// Update ticket (status, priority, assignment)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin || !hasPermission(admin, 'support.update')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { ticketId } = await params
    const body = await request.json()
    const { action, status, priority, assignToAdminId, message, isInternalNote, resolutionNotes } = body
    
    const ipAddress = request.headers.get('x-forwarded-for') || undefined
    const userAgent = request.headers.get('user-agent') || undefined
    
    // Get current ticket
    const current = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`
    if (current.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    const ticket = current[0]
    
    if (action === 'update_status' && status) {
      await sql`
        UPDATE support_tickets 
        SET status = ${status}, 
            resolved_at = ${status === 'RESOLVED' ? new Date() : ticket.resolved_at},
            closed_at = ${status === 'CLOSED' ? new Date() : ticket.closed_at},
            resolution_notes = ${resolutionNotes || ticket.resolution_notes},
            updated_at = NOW()
        WHERE id = ${ticketId}
      `
      
      await sql`
        INSERT INTO support_ticket_actions (ticket_id, admin_user_id, action_type, old_value, new_value)
        VALUES (${ticketId}, ${admin.id}, 'status_changed', ${ticket.status}, ${status})
      `
      
      await logAdminAction(admin.id, 'UPDATE_TICKET_STATUS', 'ticket', ticketId, {
        oldStatus: ticket.status,
        newStatus: status,
      }, ipAddress, userAgent, ticketId)
    }
    
    if (action === 'update_priority' && priority) {
      await sql`
        UPDATE support_tickets SET priority = ${priority}, updated_at = NOW()
        WHERE id = ${ticketId}
      `
      
      await sql`
        INSERT INTO support_ticket_actions (ticket_id, admin_user_id, action_type, old_value, new_value)
        VALUES (${ticketId}, ${admin.id}, 'priority_changed', ${ticket.priority}, ${priority})
      `
      
      await logAdminAction(admin.id, 'UPDATE_TICKET_PRIORITY', 'ticket', ticketId, {
        oldPriority: ticket.priority,
        newPriority: priority,
      }, ipAddress, userAgent, ticketId)
    }
    
    if (action === 'assign') {
      if (!hasPermission(admin, 'support.assign')) {
        return NextResponse.json({ error: 'No assign permission' }, { status: 403 })
      }
      
      await sql`
        UPDATE support_tickets 
        SET assigned_admin_id = ${assignToAdminId || admin.id}, 
            status = ${ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status},
            updated_at = NOW()
        WHERE id = ${ticketId}
      `
      
      await sql`
        INSERT INTO support_ticket_actions (ticket_id, admin_user_id, action_type, new_value)
        VALUES (${ticketId}, ${admin.id}, 'assigned', ${assignToAdminId || admin.id})
      `
      
      await logAdminAction(admin.id, 'ASSIGN_TICKET', 'ticket', ticketId, {
        assignedTo: assignToAdminId || admin.id,
      }, ipAddress, userAgent, ticketId)
    }
    
    if (action === 'add_message' && message) {
      // Check if this is first admin response
      const isFirstResponse = !ticket.first_response_at
      
      await sql`
        INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, message, is_internal_note)
        VALUES (${ticketId}, 'ADMIN', ${admin.id}, ${message}, ${isInternalNote || false})
      `
      
      if (isFirstResponse && !isInternalNote) {
        await sql`
          UPDATE support_tickets SET first_response_at = NOW(), updated_at = NOW()
          WHERE id = ${ticketId}
        `
      } else {
        await sql`
          UPDATE support_tickets SET updated_at = NOW()
          WHERE id = ${ticketId}
        `
      }
      
      await logAdminAction(admin.id, 'ADD_TICKET_MESSAGE', 'ticket', ticketId, {
        isInternalNote,
      }, ipAddress, userAgent, ticketId)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin update ticket error:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
