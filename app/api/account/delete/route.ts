import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import {
  getUserFromRequest,
  clearAuthCookies,
  revokeAllUserTokens,
  logAuditEvent,
} from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// Real account deletion, required by Google Play's Data Safety policy (the
// "Delete account URL" declared in the Play Console must lead to a working
// deletion flow - previously the Settings page button had no handler at all).
//
// This does NOT hard-delete the `users` row. Several tables reference
// users.id without ON DELETE CASCADE or SET NULL (events.created_by_id,
// event_requests.requestor_id/approver_id, families.owner_id), because
// events and requests are shared family data, not solely the deleting
// user's data - hard-deleting the row would either violate those foreign
// keys or silently destroy other family members' shared calendar history.
// Instead this scrubs every piece of personal data the user directly owns,
// revokes all access, and permanently deactivates the account so it can
// never be logged into again - the account is gone from the user's and
// their family's perspective, which is what the policy is after.
export async function POST(request: Request) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmEmail } = body

    if (confirmEmail !== user.email) {
      return NextResponse.json({ error: 'Email confirmation does not match' }, { status: 400 })
    }

    // 1. Hand off any families this user owns.
    const ownedFamilies = await sql`
      SELECT id FROM families WHERE owner_id = ${user.id}
    `

    for (const family of ownedFamilies) {
      const otherMembers = await sql`
        SELECT user_id, role FROM family_members
        WHERE family_id = ${family.id} AND user_id != ${user.id} AND is_active = true
        ORDER BY
          CASE role WHEN 'PARENT' THEN 0 WHEN 'GUARDIAN' THEN 1 ELSE 2 END,
          joined_at ASC
      `

      if (otherMembers.length > 0) {
        // Transfer ownership to the longest-standing parent/guardian (or
        // whoever else is left) so the family and its data keep existing
        // for the remaining members.
        await sql`
          UPDATE families SET owner_id = ${otherMembers[0].user_id}, updated_at = NOW()
          WHERE id = ${family.id}
        `
      } else {
        // This user was the only member - cancel any active Stripe
        // subscription before the family (and its subscription row) is
        // removed, so we don't leave an orphaned recurring charge running.
        const subs = await sql`
          SELECT stripe_subscription_id FROM subscriptions
          WHERE family_id = ${family.id} AND stripe_subscription_id IS NOT NULL
        `
        for (const sub of subs) {
          try {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id)
          } catch (err) {
            // Continue even if Stripe cancellation fails (e.g. already
            // cancelled) - we still want to delete the local family data.
            console.error('Failed to cancel Stripe subscription during account deletion:', err)
          }
        }

        // Cascades to family_members, calendars -> events, tasks,
        // subscriptions, calendar_sync_connections, saved_places, etc.
        await sql`DELETE FROM families WHERE id = ${family.id}`
      }
    }

    // 2. Delete data this user directly owns, wherever it can be removed
    // without breaking other users' shared family data.
    await sql`DELETE FROM user_favorites WHERE user_id = ${user.id}`
    await sql`DELETE FROM notifications WHERE user_id = ${user.id}`
    await sql`DELETE FROM location_pings WHERE user_id = ${user.id}`
    await sql`DELETE FROM geofence_events WHERE user_id = ${user.id}`
    await sql`
      DELETE FROM location_settings
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = ${user.id})
    `
    await sql`DELETE FROM task_comments WHERE user_id = ${user.id}`
    await sql`DELETE FROM task_history WHERE user_id = ${user.id}`
    await sql`UPDATE tasks SET assigned_to_id = NULL WHERE assigned_to_id = ${user.id}`
    await sql`DELETE FROM event_participants WHERE user_id = ${user.id}`
    await sql`DELETE FROM reminder_settings WHERE user_id = ${user.id}`
    await sql`DELETE FROM consents WHERE user_id = ${user.id}`
    await sql`DELETE FROM calendar_sync_connections WHERE user_id = ${user.id}`
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`

    // Any remaining family memberships (families this user didn't own)
    await sql`DELETE FROM family_members WHERE user_id = ${user.id}`

    // 3. Revoke all sessions.
    await revokeAllUserTokens(user.id)

    // 4. Scrub personal data and permanently deactivate the account.
    // The row itself stays (events/tasks created in shared family calendars
    // may still reference it), but every identifying field is cleared and
    // the account can never be logged into again.
    const anonymizedEmail = `deleted-${user.id}@deleted.togethrapp.com`
    await sql`
      UPDATE users
      SET
        email = ${anonymizedEmail},
        password_hash = 'DELETED',
        first_name = 'Deleted',
        last_name = 'User',
        phone = NULL,
        date_of_birth = NULL,
        profile_photo_url = NULL,
        profile_photo_path = NULL,
        is_active = false,
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    await logAuditEvent(user.id, 'DELETE', 'user', user.id, {
      metadata: { reason: 'user_requested_account_deletion' },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    await clearAuthCookies()

    return NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.',
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
