import { sql } from "@/lib/db"

// SMS notification function using Twilio (or similar service)
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables
export async function sendSmsNotification(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  // If Twilio is not configured, skip SMS
  if (!accountSid || !authToken || !fromNumber) {
    console.log('[SMS] Twilio not configured, skipping SMS notification')
    return { success: true } // Return success to not block the flow
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: phoneNumber,
          Body: message,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[SMS] Failed to send SMS:', errorData)
      return { success: false, error: errorData.message || 'Failed to send SMS' }
    }

    console.log('[SMS] SMS sent successfully to:', phoneNumber.slice(-4))
    return { success: true }
  } catch (error) {
    console.error('[SMS] Error sending SMS:', error)
    return { success: false, error: 'Failed to send SMS' }
  }
}

export type NotificationType =
  | 'EVENT_REMINDER'
  | 'EVENT_INVITATION'
  | 'EVENT_UPDATE'
  | 'EVENT_APPROVAL_REQUEST'
  | 'EVENT_APPROVED'
  | 'EVENT_REJECTED'
  | 'EVENT_CREATED'
  | 'LOCATION_ALERT'
  | 'GEOFENCE_ALERT'
  | 'FAMILY_INVITATION'
  | 'FAMILY_INVITE'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_OVERDUE'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_RESPONSE'
  | 'SUBSCRIPTION_ALERT'
  | 'SYSTEM'

type NotificationData = {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  sendSms?: boolean // If true and user has phone, also send SMS
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  data = {},
  sendSms = false
}: NotificationData): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const notificationId = crypto.randomUUID()
    
    console.log('[Notification] Creating notification:', { userId, type, title })
    
    await sql`
      INSERT INTO notifications (id, user_id, type, title, body, data, is_read, created_at)
      VALUES (
        ${notificationId},
        ${userId},
        ${type},
        ${title},
        ${body},
        ${JSON.stringify(data)}::jsonb,
        false,
        NOW()
      )
    `
    
    console.log('[Notification] Created successfully:', notificationId)
    
    // Check if user has SMS enabled and send if requested
    if (sendSms) {
      const userSmsPrefs = await sql`
        SELECT u.phone, rs.sms_enabled
        FROM users u
        LEFT JOIN reminder_settings rs ON u.id = rs.user_id
        WHERE u.id = ${userId}
      `
      if (userSmsPrefs.length > 0 && userSmsPrefs[0].phone && userSmsPrefs[0].sms_enabled) {
        await sendSmsNotification(userSmsPrefs[0].phone, `FamilyApp: ${title} - ${body}`)
      }
    }
    
    return { success: true, notificationId }
  } catch (error) {
    console.error('Failed to create notification:', error)
    return { success: false, error: 'Failed to create notification' }
  }
}

export async function notifyTaskAssigned(
  userId: string,
  taskTitle: string,
  taskId: string,
  familyId: string,
  assignedBy: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'TASK_ASSIGNED',
    title: 'New Task Assigned',
    body: `${assignedBy} assigned you a task: "${taskTitle}"`,
    data: { taskId, familyId },
    sendSms: true // Will check user preferences before sending
  })
}

export async function notifyTaskCompleted(
  userId: string,
  taskTitle: string,
  taskId: string,
  familyId: string,
  completedBy: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'TASK_COMPLETED',
    title: 'Task Completed',
    body: `${completedBy} completed the task: "${taskTitle}"`,
    data: { taskId, familyId },
    sendSms: true // Will check user preferences before sending
  })
}

export async function notifyFamilyAboutEvent(
  familyId: string,
  eventTitle: string,
  eventId: string,
  creatorName: string,
  excludeUserId?: string
): Promise<void> {
  // Notify ALL active family members with linked accounts
  let members
  if (excludeUserId) {
    members = await sql`
      SELECT fm.user_id, u.phone
      FROM family_members fm
      LEFT JOIN users u ON fm.user_id = u.id
      WHERE fm.family_id = ${familyId}
        AND fm.is_active = true
        AND fm.user_id IS NOT NULL
        AND fm.user_id != ${excludeUserId}
    `
  } else {
    members = await sql`
      SELECT fm.user_id, u.phone
      FROM family_members fm
      LEFT JOIN users u ON fm.user_id = u.id
      WHERE fm.family_id = ${familyId}
        AND fm.is_active = true
        AND fm.user_id IS NOT NULL
    `
  }
  
  for (const member of members) {
    // Create in-app notification
    await createNotification({
      userId: member.user_id,
      type: 'EVENT_CREATED',
      title: 'New Family Event',
      body: `${creatorName} created a new event: "${eventTitle}"`,
      data: { eventId, familyId, sendSms: !!member.phone }
    })
    
    // Send SMS if user has phone number
    if (member.phone) {
      await sendSmsNotification(
        member.phone,
        `FamilyApp: ${creatorName} created a new event: "${eventTitle}". Open the app to view details.`
      )
    }
  }
}

export async function checkAndNotifyOverdueTasks(): Promise<{ notified: number }> {
  const overdueTasks = await sql`
    SELECT t.id, t.title, t.assigned_to_id, t.child_profile_id, t.family_id,
           cp.family_member_id as child_member_id
    FROM tasks t
    LEFT JOIN child_profiles cp ON t.child_profile_id = cp.id
    WHERE t.status IN ('pending', 'in_progress', 'PENDING', 'IN_PROGRESS')
      AND t.due_date < NOW()
      AND t.due_date > NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.data->>'taskId' = t.id 
          AND n.type = 'TASK_OVERDUE'
          AND n.created_at > NOW() - INTERVAL '12 hours'
      )
  `
  
  let notified = 0
  
  for (const task of overdueTasks) {
    const usersToNotify: string[] = []
    
    if (task.assigned_to_id) {
      usersToNotify.push(task.assigned_to_id)
    }
    
    if (task.child_member_id) {
      const childMember = await sql`
        SELECT user_id FROM family_members WHERE id = ${task.child_member_id}
      `
      if (childMember.length > 0 && childMember[0].user_id) {
        usersToNotify.push(childMember[0].user_id)
      }
    }
    
    const parents = await sql`
      SELECT fm.user_id
      FROM family_members fm
      WHERE fm.family_id = ${task.family_id}
        AND fm.is_active = true
        AND fm.role IN ('PARENT', 'GUARDIAN')
    `
    
    for (const parent of parents) {
      if (!usersToNotify.includes(parent.user_id)) {
        usersToNotify.push(parent.user_id)
      }
    }
    
    for (const userId of usersToNotify) {
      await createNotification({
        userId,
        type: 'TASK_OVERDUE',
        title: 'Task Overdue',
        body: `Task "${task.title}" is overdue and needs attention`,
        data: { 
          taskId: task.id, 
          familyId: task.family_id,
          isOverdue: true,
          dueDate: task.due_date
        }
      })
      notified++
    }
  }
  
  return { notified }
}

export async function checkAndNotifyEventReminders(): Promise<{ notified: number }> {
  const events = await sql`
    SELECT e.id, e.title, e.start_time, e.location, e.reminder_minutes,
           e.created_by_id, c.family_id
    FROM events e
    JOIN calendars c ON e.calendar_id = c.id
    WHERE e.status IN ('CONFIRMED', 'APPROVED')
      AND e.reminder_minutes IS NOT NULL
      AND e.start_time > NOW()
      AND e.start_time <= NOW() + (e.reminder_minutes || ' minutes')::INTERVAL
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.data->>'eventId' = e.id 
          AND n.type = 'EVENT_REMINDER'
          AND n.data->>'reminderMinutes' IS NOT NULL
          AND n.created_at > NOW() - INTERVAL '1 hour'
      )
  `
  
  let notified = 0
  
  for (const event of events) {
    const participants = await sql`
      SELECT ep.user_id
      FROM event_participants ep
      WHERE ep.event_id = ${event.id}
        AND ep.status != 'DECLINED'
    `
    
    const members = await sql`
      SELECT fm.user_id
      FROM family_members fm
      WHERE fm.family_id = ${event.family_id}
        AND fm.is_active = true
    `
    
    const usersToNotify = new Set<string>()
    participants.forEach((p: { user_id: string }) => usersToNotify.add(p.user_id))
    members.forEach((m: { user_id: string }) => usersToNotify.add(m.user_id))
    
    const startTime = new Date(event.start_time)
    const timeText = startTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    
    for (const userId of usersToNotify) {
      await createNotification({
        userId,
        type: 'EVENT_REMINDER',
        title: `Reminder: ${event.title}`,
        body: `"${event.title}" starts at ${timeText}${event.location ? ` at ${event.location}` : ''}`,
        data: { 
          eventId: event.id, 
          familyId: event.family_id,
          reminderMinutes: event.reminder_minutes
        }
      })
      notified++
    }
  }
  
  return { notified }
}

export async function checkAndNotifyUpcomingDueDates(): Promise<{ 
  tasksNotified: number
  eventsNotified: number 
}> {
  let tasksNotified = 0
  let eventsNotified = 0
  
  // Tasks due in next 48 hours
  const upcomingTasks = await sql`
    SELECT t.id, t.title, t.due_date, t.assigned_to_id, t.child_profile_id, 
           t.family_id, t.created_by_id, t.priority,
           cp.family_member_id as child_member_id
    FROM tasks t
    LEFT JOIN child_profiles cp ON t.child_profile_id = cp.id
    WHERE t.status IN ('pending', 'in_progress', 'on_hold', 'PENDING', 'IN_PROGRESS', 'ON_HOLD')
      AND t.due_date >= NOW()
      AND t.due_date <= NOW() + INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.data->>'taskId' = t.id 
          AND n.type = 'TASK_ASSIGNED'
          AND (n.data->>'reminder48h')::boolean = true
          AND n.created_at > NOW() - INTERVAL '24 hours'
      )
  `
  
  for (const task of upcomingTasks) {
    const dueDate = new Date(task.due_date)
    const now = new Date()
    const hoursUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    const usersToNotify: string[] = []
    
    if (task.assigned_to_id) {
      usersToNotify.push(task.assigned_to_id)
    }
    
    if (task.child_profile_id && task.child_member_id) {
      const childMember = await sql`
        SELECT user_id FROM family_members WHERE id = ${task.child_member_id}
      `
      if (childMember.length > 0 && childMember[0].user_id) {
        usersToNotify.push(childMember[0].user_id)
      }
    }
    
    if (task.created_by_id && !usersToNotify.includes(task.created_by_id)) {
      usersToNotify.push(task.created_by_id)
    }
    
    const parents = await sql`
      SELECT fm.user_id
      FROM family_members fm
      WHERE fm.family_id = ${task.family_id}
        AND fm.is_active = true
        AND fm.role IN ('PARENT', 'GUARDIAN')
    `
    
    for (const parent of parents) {
      if (!usersToNotify.includes(parent.user_id)) {
        usersToNotify.push(parent.user_id)
      }
    }
    
    const timeText = hoursUntilDue <= 1 
      ? 'in less than an hour' 
      : hoursUntilDue < 24 
        ? `in ${hoursUntilDue} hours`
        : `in ${Math.floor(hoursUntilDue / 24)} day${Math.floor(hoursUntilDue / 24) > 1 ? 's' : ''}`
    
    for (const userId of usersToNotify) {
      await createNotification({
        userId,
        type: 'TASK_ASSIGNED',
        title: `Task Due Soon: ${task.title}`,
        body: `Task "${task.title}" is due ${timeText}${task.priority === 'high' ? ' (High Priority)' : ''}`,
        data: { 
          taskId: task.id, 
          familyId: task.family_id,
          dueDate: task.due_date,
          reminder48h: true
        }
      })
      tasksNotified++
    }
  }
  
  // Events in next 48 hours
  const upcomingEvents = await sql`
    SELECT e.id, e.title, e.start_time, e.end_time, e.location, e.is_all_day,
           e.created_by_id, c.family_id
    FROM events e
    JOIN calendars c ON e.calendar_id = c.id
    WHERE e.status IN ('CONFIRMED', 'APPROVED')
      AND e.start_time >= NOW()
      AND e.start_time <= NOW() + INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.data->>'eventId' = e.id 
          AND n.type = 'EVENT_REMINDER'
          AND (n.data->>'reminder48h')::boolean = true
          AND n.created_at > NOW() - INTERVAL '24 hours'
      )
  `
  
  for (const event of upcomingEvents) {
    const startTime = new Date(event.start_time)
    const now = new Date()
    const hoursUntilEvent = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    const members = await sql`
      SELECT fm.user_id
      FROM family_members fm
      WHERE fm.family_id = ${event.family_id}
        AND fm.is_active = true
    `
    
    const participants = await sql`
      SELECT ep.user_id
      FROM event_participants ep
      WHERE ep.event_id = ${event.id}
        AND ep.status != 'DECLINED'
    `
    
    const usersToNotify = new Set<string>()
    members.forEach((m: { user_id: string }) => usersToNotify.add(m.user_id))
    participants.forEach((p: { user_id: string }) => usersToNotify.add(p.user_id))
    
    const timeText = hoursUntilEvent <= 1 
      ? 'in less than an hour' 
      : hoursUntilEvent < 24 
        ? `in ${hoursUntilEvent} hours`
        : 'tomorrow'
    
    for (const userId of usersToNotify) {
      await createNotification({
        userId,
        type: 'EVENT_REMINDER',
        title: `Upcoming Event: ${event.title}`,
        body: `"${event.title}" starts ${timeText}${event.location ? ` at ${event.location}` : ''}`,
        data: { 
          eventId: event.id, 
          familyId: event.family_id,
          startTime: event.start_time,
          reminder48h: true
        }
      })
      eventsNotified++
    }
  }
  
  return { tasksNotified, eventsNotified }
}
