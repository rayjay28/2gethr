import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

// Subscription tier definitions
// FREE: $0, PREMIUM (Basic): $3.99/mo, PREMIUM_PLUS (Premium): $7.99/mo
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: "Free",
    description: "Basic family coordination",
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      maxFamilyMembers: 4,
      maxChildren: 2,
      maxSavedPlaces: 5,
      maxCalendars: 2,
      locationSharing: false,
      geofencing: false,
      advancedRecurrence: false,
      exportCalendar: false,
      prioritySupport: false,
      phoneAlerts: false,
      smsNotifications: false,
      customReminderTimes: false,
      historyDays: 30,
    },
    featureList: [
      "Up to 2 children",
      "Shared family calendar",
      "Basic event notifications",
      "30 days history",
      "Email support",
    ],
  },
  PREMIUM: {
    name: "Basic",
    description: "Enhanced family features",
    priceMonthly: 399, // $3.99
    priceYearly: 3990, // $39.90
    features: {
      maxFamilyMembers: 6,
      maxChildren: 5,
      maxSavedPlaces: 15,
      maxCalendars: 5,
      locationSharing: false,
      geofencing: false,
      advancedRecurrence: true,
      exportCalendar: true,
      prioritySupport: true,
      phoneAlerts: false,
      smsNotifications: true,
      customReminderTimes: false,
      historyDays: 90,
    },
    featureList: [
      "Up to 5 children",
      "Advanced reminder settings",
      "Complex recurring events",
      "90 days history",
      "SMS notifications",
      "Priority support",
    ],
  },
  PREMIUM_PLUS: {
    name: "Premium",
    description: "Full family safety suite",
    priceMonthly: 799, // $7.99
    priceYearly: 7990, // $79.90
    features: {
      maxFamilyMembers: 12,
      maxChildren: -1, // Unlimited
      maxSavedPlaces: 50,
      maxCalendars: 20,
      locationSharing: true,
      geofencing: true,
      advancedRecurrence: true,
      exportCalendar: true,
      prioritySupport: true,
      phoneAlerts: true,
      smsNotifications: true,
      customReminderTimes: true,
      historyDays: 365,
    },
    featureList: [
      "Unlimited children",
      "Real-time location sharing",
      "Geofence alerts",
      "1 year history",
      "Phone alert notifications",
      "Custom reminder times",
      "Family activity reports",
      "24/7 priority support",
    ],
  },
}

// Get current family subscription
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      )
    }

    const familyId = request.nextUrl.searchParams.get("familyId") || user.primaryFamily?.id

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: "No family specified" },
        { status: 400 }
      )
    }

    // Verify user is in the family
    const membership = await sql`
      SELECT role FROM family_members 
      WHERE family_id = ${familyId} AND user_id = ${user.id} AND is_active = true
    `

    if (membership.length === 0) {
      return NextResponse.json(
        { success: false, error: "Not a member of this family" },
        { status: 403 }
      )
    }

    // Get subscription
    const subscriptions = await sql`
      SELECT 
        s.*,
        f.name as family_name, f.owner_id
      FROM subscriptions s
      JOIN families f ON s.family_id = f.id
      WHERE s.family_id = ${familyId}
      ORDER BY s.created_at DESC
      LIMIT 1
    `

    if (subscriptions.length === 0) {
      // Return free tier info
      return NextResponse.json({
        success: true,
        data: {
          tier: "FREE",
          status: "ACTIVE",
          tierInfo: SUBSCRIPTION_TIERS.FREE,
          familyId,
          isOwner: user.primaryFamily?.ownerId === user.id,
        },
      })
    }

    const subscription = subscriptions[0]
    const tierInfo = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS] || SUBSCRIPTION_TIERS.FREE

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEndsAt: subscription.trial_ends_at,
        tierInfo,
        familyId,
        familyName: subscription.family_name,
        isOwner: subscription.owner_id === user.id,
        stripeCustomerId: membership[0].role === "PARENT" ? subscription.stripe_customer_id : null,
      },
    })
  } catch (error) {
    console.error("Get subscription error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get subscription" },
      { status: 500 }
    )
  }
}

// Get all available subscription plans
export async function OPTIONS() {
  return NextResponse.json({
    success: true,
    data: {
      plans: Object.entries(SUBSCRIPTION_TIERS).map(([key, value]) => ({
        tier: key,
        ...value,
      })),
    },
  })
}
