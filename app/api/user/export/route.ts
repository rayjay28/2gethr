// Export data API - New path to bypass server cache
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'
import { verifyAccessToken } from '@/lib/auth'
import * as XLSX from 'xlsx'

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | undefined
    
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }
    
    if (!accessToken) {
      const cookieStore = await cookies()
      accessToken = cookieStore.get('access_token')?.value
    }
    
    if (!accessToken) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 })
    }
    
    const payload = await verifyAccessToken(accessToken)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    const userId = payload.userId

    // Get family IDs without role filter
    const userFamilies = await sql`SELECT family_id FROM family_members WHERE user_id = ${userId}`
    const familyIds = userFamilies.map(f => f.family_id)

    // Sequential queries to avoid issues
    const userData = await sql`
      SELECT id, email, first_name, last_name, phone, timezone, date_of_birth, created_at, last_login_at 
      FROM users WHERE id = ${userId}
    `

    const familyMembers = familyIds.length > 0 ? await sql`
      SELECT u.first_name, u.last_name, u.email, u.phone, fm.role, fm.is_active, fm.joined_at, fm.nickname, f.name as family_name
      FROM family_members fm
      JOIN families f ON fm.family_id = f.id
      JOIN users u ON fm.user_id = u.id
      WHERE fm.family_id = ANY(${familyIds})
      ORDER BY f.name, fm.joined_at
    ` : []

    const locationPings = await sql`
      SELECT latitude, longitude, accuracy, altitude, speed, heading, battery_level, timestamp 
      FROM location_pings WHERE user_id = ${userId} ORDER BY timestamp DESC LIMIT 1000
    `

    const tasks = await sql`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.category, t.due_date, t.due_time, 
        t.points_value, t.reward_description, t.is_recurring, t.recurrence_rule, t.completed_at, t.created_at, t.updated_at,
        creator.first_name || ' ' || creator.last_name as created_by,
        assignee.first_name || ' ' || assignee.last_name as assigned_to,
        approver.first_name || ' ' || approver.last_name as approved_by
      FROM tasks t
      LEFT JOIN users creator ON t.created_by_id = creator.id
      LEFT JOIN users assignee ON t.assigned_to_id = assignee.id
      LEFT JOIN users approver ON t.approved_by_id = approver.id
      WHERE t.created_by_id = ${userId} ORDER BY t.created_at DESC LIMIT 500
    `

    const assignedTasks = await sql`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.category, t.due_date, t.due_time,
        t.points_value, t.reward_description, t.is_recurring, t.completed_at, t.created_at,
        creator.first_name || ' ' || creator.last_name as assigned_by,
        approver.first_name || ' ' || approver.last_name as approved_by
      FROM tasks t
      LEFT JOIN users creator ON t.created_by_id = creator.id
      LEFT JOIN users approver ON t.approved_by_id = approver.id
      WHERE t.assigned_to_id = ${userId} ORDER BY t.created_at DESC LIMIT 500
    `

    const events = await sql`
      SELECT e.id, e.title, e.description, e.location, e.start_time, e.end_time, e.is_all_day, e.status, 
        e.visibility, e.color, e.is_recurring, e.created_at, e.updated_at,
        c.name as calendar_name, sp.name as place_name, sp.address as place_address
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      LEFT JOIN saved_places sp ON e.saved_place_id = sp.id
      WHERE e.created_by_id = ${userId} ORDER BY e.start_time DESC LIMIT 500
    `

    const paymentHistory = familyIds.length > 0 ? await sql`
      SELECT pt.id, pt.amount, pt.currency, pt.status, pt.description, pt.stripe_payment_id, pt.created_at,
        s.tier as subscription_tier, s.status as subscription_status
      FROM payment_transactions pt
      LEFT JOIN subscriptions s ON pt.subscription_id = s.id
      WHERE s.family_id = ANY(${familyIds}) ORDER BY pt.created_at DESC LIMIT 200
    ` : []

    const auditLogs = await sql`
      SELECT action, entity_type, entity_id, ip_address, user_agent, created_at, metadata
      FROM audit_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500
    `

    const workbook = XLSX.utils.book_new()

    // Profile
    const profileData = userData[0] ? [{
      'First Name': userData[0].first_name || '',
      'Last Name': userData[0].last_name || '',
      'Email': userData[0].email || '',
      'Phone': userData[0].phone || '',
      'Timezone': userData[0].timezone || '',
      'Date of Birth': userData[0].date_of_birth ? new Date(userData[0].date_of_birth as string).toLocaleDateString() : '',
      'Account Created': userData[0].created_at ? new Date(userData[0].created_at as string).toLocaleString() : '',
      'Last Login': userData[0].last_login_at ? new Date(userData[0].last_login_at as string).toLocaleString() : '',
    }] : [{ 'Info': 'No profile data' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(profileData), 'Profile')

    // Family Members
    const familyData = familyMembers.length > 0 ? familyMembers.map((fm: Record<string, unknown>) => ({
      'Family': fm.family_name || '', 'First Name': fm.first_name || '', 'Last Name': fm.last_name || '',
      'Nickname': fm.nickname || '', 'Email': fm.email || '', 'Phone': fm.phone || '',
      'Role': fm.role || '', 'Active': fm.is_active ? 'Yes' : 'No',
      'Joined Date': fm.joined_at ? new Date(fm.joined_at as string).toLocaleDateString() : '',
    })) : [{ 'Info': 'No family members' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(familyData), 'Family Members')

    // Location
    const locationData = locationPings.length > 0 ? locationPings.map((l: Record<string, unknown>) => ({
      'Latitude': l.latitude || '', 'Longitude': l.longitude || '', 'Accuracy (m)': l.accuracy || '',
      'Altitude': l.altitude || '', 'Speed': l.speed || '', 'Heading': l.heading || '',
      'Battery Level': l.battery_level ? `${l.battery_level}%` : '',
      'Timestamp': l.timestamp ? new Date(l.timestamp as string).toLocaleString() : '',
    })) : [{ 'Info': 'No location data' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(locationData), 'Location Data')

    // Tasks Created
    const tasksData = tasks.length > 0 ? tasks.map((t: Record<string, unknown>) => ({
      'ID': t.id || '', 'Title': t.title || '', 'Description': t.description || '',
      'Status': t.status || '', 'Priority': t.priority || '', 'Category': t.category || '',
      'Due Date': t.due_date ? new Date(t.due_date as string).toLocaleDateString() : '',
      'Due Time': t.due_time || '', 'Points': t.points_value || 0, 'Reward': t.reward_description || '',
      'Recurring': t.is_recurring ? 'Yes' : 'No', 'Recurrence Rule': t.recurrence_rule || '',
      'Assigned To': t.assigned_to || '', 'Approved By': t.approved_by || '',
      'Completed At': t.completed_at ? new Date(t.completed_at as string).toLocaleString() : '',
      'Created At': t.created_at ? new Date(t.created_at as string).toLocaleString() : '',
    })) : [{ 'Info': 'No tasks created' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tasksData), 'Tasks Created')

    // Assigned Tasks
    const assignedTasksData = assignedTasks.length > 0 ? assignedTasks.map((t: Record<string, unknown>) => ({
      'ID': t.id || '', 'Title': t.title || '', 'Description': t.description || '',
      'Status': t.status || '', 'Priority': t.priority || '', 'Category': t.category || '',
      'Due Date': t.due_date ? new Date(t.due_date as string).toLocaleDateString() : '',
      'Due Time': t.due_time || '', 'Points': t.points_value || 0, 'Reward': t.reward_description || '',
      'Recurring': t.is_recurring ? 'Yes' : 'No', 'Assigned By': t.assigned_by || '', 'Approved By': t.approved_by || '',
      'Completed At': t.completed_at ? new Date(t.completed_at as string).toLocaleString() : '',
      'Created At': t.created_at ? new Date(t.created_at as string).toLocaleString() : '',
    })) : [{ 'Info': 'No tasks assigned' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assignedTasksData), 'Assigned Tasks')

    // Events
    const eventsData = events.length > 0 ? events.map((e: Record<string, unknown>) => ({
      'ID': e.id || '', 'Title': e.title || '', 'Description': e.description || '',
      'Calendar': e.calendar_name || '', 'Location': e.location || '',
      'Place Name': e.place_name || '', 'Place Address': e.place_address || '',
      'Start Time': e.start_time ? new Date(e.start_time as string).toLocaleString() : '',
      'End Time': e.end_time ? new Date(e.end_time as string).toLocaleString() : '',
      'All Day': e.is_all_day ? 'Yes' : 'No', 'Status': e.status || '', 'Visibility': e.visibility || '',
      'Color': e.color || '', 'Recurring': e.is_recurring ? 'Yes' : 'No',
      'Created At': e.created_at ? new Date(e.created_at as string).toLocaleString() : '',
    })) : [{ 'Info': 'No events' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(eventsData), 'Events')

    // Payment History
    const paymentData = paymentHistory.length > 0 ? paymentHistory.map((p: Record<string, unknown>) => ({
      'Transaction ID': p.id || '', 'Amount': p.amount ? `$${((p.amount as number) / 100).toFixed(2)}` : '',
      'Currency': p.currency || 'USD', 'Status': p.status || '', 'Description': p.description || '',
      'Subscription Tier': p.subscription_tier || '', 'Subscription Status': p.subscription_status || '',
      'Stripe Payment ID': p.stripe_payment_id || '',
      'Date': p.created_at ? new Date(p.created_at as string).toLocaleString() : '',
    })) : [{ 'Info': 'No payment history' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentData), 'Payment History')

    // Account Activity
    const activityData = auditLogs.length > 0 ? auditLogs.map((a: Record<string, unknown>) => ({
      'Action': a.action || '', 'Entity Type': a.entity_type || '', 'Entity ID': a.entity_id || '',
      'IP Address': a.ip_address || '', 'User Agent': a.user_agent || '',
      'Metadata': a.metadata ? JSON.stringify(a.metadata) : '',
      'Timestamp': a.created_at ? new Date(a.created_at as string).toLocaleString() : '',
    })) : [{ 'Info': 'No account activity' }]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(activityData), 'Account Activity')

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="togethr-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
