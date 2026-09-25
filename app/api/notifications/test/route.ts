import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"

// POST - Create a test notification for the current user
// This helps verify the notification system is working
export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { type = 'SYSTEM' } = body

    // Create a test notification based on type
    const notificationData: Record<string, { title: string; body: string; data: Record<string, unknown> }> = {
      SYSTEM: {
        title: 'Test Notification',
        body: 'This is a test notification to verify the system is working correctly.',
        data: { test: true, timestamp: new Date().toISOString() }
      },
      TASK_ASSIGNED: {
        title: 'New Task Assigned',
        body: 'You have been assigned a test task: "Clean your room"',
        data: { taskId: 'test-task-id', test: true }
      },
      TASK_COMPLETED: {
        title: 'Task Completed',
        body: 'A family member completed: "Do homework"',
        data: { taskId: 'test-task-id', test: true }
      },
      EVENT_REMINDER: {
        title: 'Upcoming Event',
        body: 'Soccer Practice starts in 30 minutes',
        data: { eventId: 'test-event-id', reminderMinutes: 30, test: true }
      },
      TASK_OVERDUE: {
        title: 'Task Overdue',
        body: 'Task "Take out trash" is overdue and needs attention',
        data: { taskId: 'test-task-id', isOverdue: true, test: true }
      },
      LOCATION_ALERT: {
        title: 'Location Request',
        body: 'A family member has requested your current location',
        data: { subType: 'LOCATION_REQUEST', test: true }
      }
    }

    const notification = notificationData[type] || notificationData.SYSTEM

    const result = await createNotification({
      userId: user.id,
      type: type as any,
      title: notification.title,
      body: notification.body,
      data: notification.data
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification created',
        notificationId: result.notificationId,
        type
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Test notification error:", error)
    return NextResponse.json({ error: "Failed to create test notification" }, { status: 500 })
  }
}

// GET - Get notification system status
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get notification counts
    const counts = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
      FROM notifications
      WHERE user_id = ${user.id}
    `

    // Get recent notification types
    const recentTypes = await sql`
      SELECT type, COUNT(*) as count
      FROM notifications
      WHERE user_id = ${user.id}
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY type
      ORDER BY count DESC
    `

    return NextResponse.json({
      success: true,
      data: {
        total: parseInt(counts[0].total),
        unread: parseInt(counts[0].unread),
        last24Hours: parseInt(counts[0].last_24h),
        last7Days: parseInt(counts[0].last_7d),
        recentTypes: recentTypes.map(t => ({ type: t.type, count: parseInt(t.count) }))
      }
    })
  } catch (error) {
    console.error("Notification status error:", error)
    return NextResponse.json({ error: "Failed to get notification status" }, { status: 500 })
  }
}
