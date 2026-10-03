import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import type { NotificationChannel } from '@/lib/notifications'

const VALID_NOTIFY_CHANNELS: NotificationChannel[] = ['in_app', 'push', 'email', 'sms']

// GET - List the current user's standalone reminders.
// These are personal reminders ("pick up dry cleaning", "take medication") -
// not tied to a task or calendar event - so by default this returns
// reminders the signed-in user owns (user_id), not every reminder in their
// family. A family member can still see reminders someone set for them by
// filtering with assignedToMe, since forUserId lets a parent create a
// reminder on a child/spouse's behalf.
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.toUpperCase()
    const familyId = searchParams.get('familyId')

    // Restrict to families the user actually belongs to (same guard as
    // /api/tasks) so a client-supplied familyId can't be used to read
    // another family's reminders.
    const memberships = await sql`
      SELECT family_id FROM family_members
      WHERE user_id = ${user.id} AND is_active = true
    `
    const myFamilyIds = memberships.map((m: { family_id: string }) => m.family_id)
    if (familyId && !myFamilyIds.includes(familyId)) {
      return NextResponse.json({ error: 'Family not found or access denied' }, { status: 403 })
    }

    const normalizedStatus = status && status !== 'ALL' ? status : null

    const reminders = await sql`
      SELECT r.*,
             u_creator.first_name as creator_first_name, u_creator.last_name as creator_last_name,
             f.name as family_name
      FROM reminders r
      LEFT JOIN users u_creator ON r.created_by_id = u_creator.id
      LEFT JOIN families f ON r.family_id = f.id
      WHERE r.user_id = ${user.id}
        AND r.status != 'ARCHIVED'
        ${familyId ? sql`AND r.family_id = ${familyId}` : sql``}
        ${normalizedStatus ? sql`AND r.status = ${normalizedStatus}` : sql``}
      ORDER BY r.remind_at ASC
    `

    return NextResponse.json({ data: reminders })
  } catch (error) {
    console.error('Reminders GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

// POST - Create a new standalone reminder
export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      familyId,
      forUserId,
      title,
      description,
      remindAt,
      isRecurring = false,
      recurrenceRule,
      notifyChannels,
    } = body

    if (!title || !remindAt) {
      return NextResponse.json({ error: 'Title and remindAt are required' }, { status: 400 })
    }

    const remindAtDate = new Date(remindAt)
    if (Number.isNaN(remindAtDate.getTime())) {
      return NextResponse.json({ error: 'remindAt must be a valid date/time' }, { status: 400 })
    }

    const resolvedFamilyId = familyId || user.primaryFamily?.id
    if (!resolvedFamilyId) {
      return NextResponse.json({ error: 'No family to attach this reminder to' }, { status: 400 })
    }

    // Verify the creator belongs to that family
    const membership = await sql`
      SELECT role FROM family_members
      WHERE family_id = ${resolvedFamilyId} AND user_id = ${user.id} AND is_active = true
    `
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Not a member of this family' }, { status: 403 })
    }

    // A reminder can be set for someone else in the family (e.g. a parent
    // reminding a child), defaulting to the creator themselves.
    const ownerId = forUserId || user.id
    if (ownerId !== user.id) {
      const ownerMembership = await sql`
        SELECT 1 FROM family_members
        WHERE family_id = ${resolvedFamilyId} AND user_id = ${ownerId} AND is_active = true
      `
      if (ownerMembership.length === 0) {
        return NextResponse.json({ error: 'That person is not in this family' }, { status: 400 })
      }
    }

    const normalizedNotifyChannels: NotificationChannel[] | null =
      Array.isArray(notifyChannels) && notifyChannels.length > 0
        ? notifyChannels.filter((c: unknown): c is NotificationChannel =>
            typeof c === 'string' && (VALID_NOTIFY_CHANNELS as string[]).includes(c)
          )
        : null

    const reminder = await sql`
      INSERT INTO reminders (
        family_id, user_id, created_by_id, title, description, remind_at,
        is_recurring, recurrence_rule, status, notify_channels
      ) VALUES (
        ${resolvedFamilyId}, ${ownerId}, ${user.id}, ${title}, ${description || null},
        ${remindAtDate.toISOString()}, ${isRecurring}, ${isRecurring ? recurrenceRule : null},
        'PENDING', ${normalizedNotifyChannels}
      )
      RETURNING *
    `

    return NextResponse.json({ data: reminder[0] }, { status: 201 })
  } catch (error) {
    console.error('Reminders POST error:', error)
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}
