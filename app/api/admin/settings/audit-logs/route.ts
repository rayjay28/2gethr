import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromToken } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent audit logs for this admin
    const logs = await sql`
      SELECT 
        id, action, target_type, target_id, metadata, ip_address, user_agent, created_at
      FROM admin_action_logs
      WHERE admin_user_id = ${admin.id}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        targetType: log.target_type,
        targetId: log.target_id,
        details: log.metadata,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }))
    })
  } catch (error) {
    console.error('Audit logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
