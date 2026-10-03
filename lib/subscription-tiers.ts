// Single source of truth for subscription tier pricing, limits and feature
// flags. Previously this same data was hand-duplicated in four places
// (the public /pricing page, the in-app /subscription page's hook, the
// /api/subscriptions route, and lib/services/subscription.ts) and they had
// drifted apart - most notably Basic/Premium were repriced to $3.99/$7.99
// in the in-app hook only, so the marketing page and the backend still
// quoted the old $2.99/$4.99. Importing from here instead of re-typing the
// numbers is what keeps that from happening again.
//
// This file has no server-only imports (no db, no Node APIs) so it is safe
// to import from both server code (API routes, services) and client
// components ('use client' hooks and pages).

export const SUBSCRIPTION_TIER_KEYS = ["FREE", "PREMIUM", "PREMIUM_PLUS"] as const
export type SubscriptionTierKey = (typeof SUBSCRIPTION_TIER_KEYS)[number]

// Internal keys for each gated capability. UI code should check
// `tierInfo.features.<key>` (or `access.featureFlags.<key>` on the client)
// rather than comparing `tier === 'PREMIUM_PLUS'` by name, so that a tier's
// entitlements only ever need to change in one place.
export interface TierFeatureFlags {
  locationSharing: boolean
  geofencing: boolean
  advancedRecurrence: boolean
  exportCalendar: boolean
  prioritySupport: boolean
  phoneAlerts: boolean
  smsNotifications: boolean
  customReminderTimes: boolean
}

export interface TierLimits {
  maxFamilyMembers: number
  maxChildren: number // -1 = unlimited
  maxSavedPlaces: number
  maxCalendars: number
  historyDays: number
}

export interface TierDefinition {
  key: SubscriptionTierKey
  name: string
  description: string
  /** Cents, to match Stripe's integer-amount convention. */
  priceMonthlyCents: number
  priceAnnualCents: number
  limits: TierLimits
  features: TierFeatureFlags
  /** Human-readable bullets shown with a checkmark on pricing/upgrade UI. */
  featureList: string[]
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierKey, TierDefinition> = {
  FREE: {
    key: "FREE",
    name: "Free",
    description: "Basic family coordination",
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    limits: {
      maxFamilyMembers: 4,
      maxChildren: 2,
      maxSavedPlaces: 5,
      maxCalendars: 2,
      historyDays: 30,
    },
    features: {
      locationSharing: false,
      geofencing: false,
      advancedRecurrence: false,
      exportCalendar: false,
      prioritySupport: false,
      phoneAlerts: false,
      smsNotifications: false,
      customReminderTimes: false,
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
    key: "PREMIUM",
    name: "Basic",
    description: "Enhanced family features",
    priceMonthlyCents: 399, // $3.99
    priceAnnualCents: 3990, // $39.90
    limits: {
      maxFamilyMembers: 6,
      maxChildren: 5,
      maxSavedPlaces: 15,
      maxCalendars: 5,
      historyDays: 90,
    },
    features: {
      locationSharing: false,
      geofencing: false,
      advancedRecurrence: true,
      exportCalendar: true,
      prioritySupport: true,
      phoneAlerts: false,
      smsNotifications: true,
      customReminderTimes: false,
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
    key: "PREMIUM_PLUS",
    name: "Premium",
    description: "Full family safety suite",
    priceMonthlyCents: 799, // $7.99
    priceAnnualCents: 7990, // $79.90
    limits: {
      maxFamilyMembers: 12,
      maxChildren: -1, // Unlimited
      maxSavedPlaces: 50,
      maxCalendars: 20,
      historyDays: 365,
    },
    features: {
      locationSharing: true,
      geofencing: true,
      advancedRecurrence: true,
      exportCalendar: true,
      prioritySupport: true,
      phoneAlerts: true,
      smsNotifications: true,
      customReminderTimes: true,
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

export function getTierDefinition(tier: string | null | undefined): TierDefinition {
  const key = (tier || "FREE").toUpperCase() as SubscriptionTierKey
  return SUBSCRIPTION_TIERS[key] || SUBSCRIPTION_TIERS.FREE
}

/** Cents -> display dollars, e.g. 399 -> "3.99". */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Ordered list of tiers, Free -> Basic -> Premium, for rendering pricing grids. */
export function listTierDefinitions(): TierDefinition[] {
  return SUBSCRIPTION_TIER_KEYS.map((key) => SUBSCRIPTION_TIERS[key])
}

/**
 * Whether a given tier includes a specific gated capability. Prefer this
 * (or the equivalent `access.featureFlags[feature]` on the client) over
 * comparing tier names directly - it keeps entitlement checks correct even
 * if a feature later moves between tiers.
 */
export function tierHasFeature(tier: string | null | undefined, feature: keyof TierFeatureFlags): boolean {
  return getTierDefinition(tier).features[feature]
}
