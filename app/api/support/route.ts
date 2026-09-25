import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { nanoid } from 'nanoid'

// GET - List user's support tickets
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tickets = await sql`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM support_ticket_messages WHERE ticket_id = t.id) as message_count,
        (SELECT COUNT(*) FROM support_ticket_messages 
         WHERE ticket_id = t.id 
         AND sender_type = 'ADMIN' 
         AND created_at > COALESCE(
           (SELECT MAX(created_at) FROM support_ticket_messages 
            WHERE ticket_id = t.id AND sender_type = 'USER'),
           t.created_at
         )
        ) as unread_replies
      FROM support_tickets t
      WHERE t.user_id = ${user.id}
      ORDER BY t.updated_at DESC
    `

    return NextResponse.json({ data: tickets })
  } catch (error) {
    console.error('Support tickets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, description, category, priority = 'MEDIUM', familyId } = body

    if (!subject || !description || !category) {
      return NextResponse.json({ error: 'Subject, description, and category are required' }, { status: 400 })
    }

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${nanoid(4).toUpperCase()}`

    const ticket = await sql`
      INSERT INTO support_tickets (
        id, ticket_number, user_id, family_id, subject, description, 
        category, priority, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${ticketNumber}, ${user.id}, ${familyId || null}, 
        ${subject}, ${description}, ${category.toUpperCase()}, 
        ${priority.toUpperCase()}, 'OPEN', NOW(), NOW()
      )
      RETURNING *
    `

    // Add initial message as the description (sender_id is NULL for user messages since user.id is text not uuid)
    await sql`
      INSERT INTO support_ticket_messages (
        id, ticket_id, sender_type, message, is_internal_note, created_at
      ) VALUES (
        gen_random_uuid(), ${ticket[0].id}, 'USER', ${description}, false, NOW()
      )
    `

    return NextResponse.json({ data: ticket[0] }, { status: 201 })
  } catch (error) {
    console.error('Support ticket POST error:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
