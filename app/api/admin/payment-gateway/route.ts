import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminFromToken } from '@/lib/admin-auth'

// GET - Get payment gateway settings
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await sql`
      SELECT id, provider, display_name, is_active,
             merchant_id, webhook_url,
             supports_recurring, supports_refunds,
             created_at, updated_at
      FROM payment_gateway_settings
      ORDER BY is_active DESC, display_name ASC
    `

    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Get payment gateway settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get payment gateway settings' },
      { status: 500 }
    )
  }
}

// POST - Create or update payment gateway settings
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      gatewayName,
      displayName,
      merchantId,
      apiKey,
      apiSecret,
      apiEndpoint,
      webhookUrl,
      webhookSecret,
      isActive = true,
      settings = {}
    } = body

    if (!gatewayName || !displayName || !merchantId) {
      return NextResponse.json(
        { success: false, error: 'Gateway name, display name, and merchant ID are required' },
        { status: 400 }
      )
    }

    // Check if gateway already exists
    const existing = await sql`
      SELECT id FROM payment_gateway_settings WHERE provider = ${gatewayName}
    `

    let result
    if (existing.length > 0) {
      // Update existing
      result = await sql`
        UPDATE payment_gateway_settings SET
          display_name = ${displayName},
          merchant_id = ${merchantId},
          api_key_encrypted = ${apiKey || null},
          api_secret_encrypted = ${apiSecret || null},
          webhook_url = ${webhookUrl || null},
          webhook_secret_encrypted = ${webhookSecret || null},
          is_active = ${isActive},
          settings = ${JSON.stringify({ ...settings, webhookSecret, apiEndpoint })}::jsonb,
          updated_at = NOW(),
          configured_by_admin_id = ${admin.id}::uuid
        WHERE provider = ${gatewayName}
        RETURNING id, provider, display_name, is_active, merchant_id
      `
    } else {
      // Create new
      result = await sql`
        INSERT INTO payment_gateway_settings (
          id, provider, display_name, merchant_id,
          api_key_encrypted, api_secret_encrypted,
          webhook_url, webhook_secret_encrypted,
          is_active, settings,
          created_at, updated_at, configured_by_admin_id
        ) VALUES (
          gen_random_uuid(), ${gatewayName}, ${displayName}, ${merchantId},
          ${apiKey || null}, ${apiSecret || null},
          ${webhookUrl || null}, ${webhookSecret || null},
          ${isActive}, ${JSON.stringify({ ...settings, apiEndpoint })}::jsonb,
          NOW(), NOW(), ${admin.id}::uuid
        )
        RETURNING id, provider, display_name, is_active, merchant_id
      `
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      message: existing.length > 0 ? 'Payment gateway updated' : 'Payment gateway connected'
    })
  } catch (error) {
    console.error('Save payment gateway settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save payment gateway settings' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a payment gateway
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    const admin = token ? await getAdminFromToken(token) : null
    
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gatewayName = searchParams.get('gateway')

    if (!gatewayName) {
      return NextResponse.json(
        { success: false, error: 'Gateway name is required' },
        { status: 400 }
      )
    }

    await sql`DELETE FROM payment_gateway_settings WHERE provider = ${gatewayName}`

    return NextResponse.json({
      success: true,
      message: 'Payment gateway removed'
    })
  } catch (error) {
    console.error('Delete payment gateway error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete payment gateway' },
      { status: 500 }
    )
  }
}
