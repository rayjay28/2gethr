import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminFromToken, hasPermission, logAdminAction } from '@/lib/admin-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(admin, 'risk_flags.write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { flagId } = await params
    const { resolution } = await request.json()

    if (!resolution?.trim()) {
      return NextResponse.json({ error: 'Resolution notes required' }, { status: 400 })
    }

    // Get flag details first
    const existing = await sql`
      SELECT * FROM risk_flags WHERE id = ${flagId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Risk flag not found' }, { status: 404 })
    }

    // Update flag
    await sql`
      UPDATE risk_flags
      SET 
        status = 'resolved',
        reviewed_at = NOW(),
        reviewed_by_admin_id = ${admin.id}::uuid,
        resolution_notes = ${resolution.trim()},
        updated_at = NOW()
      WHERE id = ${flagId}::uuid
    `

    // Log action
    await logAdminAction(
      admin.id,
      'RESOLVE_RISK_FLAG',
      'risk_flag',
      flagId,
      request,
      { resolution: resolution.trim(), flagType: existing[0].flag_type }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resolving risk flag:', error)
    return NextResponse.json({ error: 'Failed to resolve flag' }, { status: 500 })
  }
}
