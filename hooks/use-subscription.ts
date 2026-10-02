'use client'

import useSWR from 'swr'
import { useCallback } from 'react'
import { authFetch } from './use-auth'

export interface Subscription {
  id: string
  familyId: string
  tier: 'FREE' | 'PREMIUM' | 'PREMIUM_PLUS'
  status: 'ACTIVE' | 'TRIALING' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface PremiumAccess {
  hasPremium: boolean
  tier: string
  features: string[]
  limits: {
    maxChildren: number
    historyDays: number
    maxSavedPlaces: number
    maxFamilyMembers: number
    maxCalendars: number
  }
}

export interface SubscriptionTierInfo {
  name: string
  description: string
  price: { monthly: number; annual: number }
  features: string[]
}

interface APISubscriptionResponse {
  success: boolean
  data?: {
    id?: string
    tier: string
    status: string
    currentPeriodStart?: string
    currentPeriodEnd?: string
    cancelAtPeriodEnd?: boolean
    trialEndsAt?: string
    tierInfo: {
      features: {
        maxFamilyMembers: number
        maxSavedPlaces: number
        maxCalendars: number
        locationSharing: boolean
        geofencing: boolean
        advancedRecurrence: boolean
        exportCalendar: boolean
        prioritySupport: boolean
      }
      featureList: string[]
    }
  }
}

const fetcher = async (url: string): Promise<{ subscription: Subscription | null; access: PremiumAccess }> => {
  const res = await authFetch(url, { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 404) return {
      subscription: null,
      access: {
        hasPremium: false,
        tier: 'FREE',
        features: [],
        limits: { maxChildren: 2, historyDays: 30, maxSavedPlaces: 5, maxFamilyMembers: 4, maxCalendars: 2 },
      }
    }
    throw new Error('Failed to fetch')
  }
  
  const json: APISubscriptionResponse = await res.json()
  
  if (!json.success || !json.data) {
    return {
      subscription: null,
      access: {
        hasPremium: false,
        tier: 'FREE',
        features: [],
        limits: { maxChildren: 2, historyDays: 30, maxSavedPlaces: 5, maxFamilyMembers: 4, maxCalendars: 2 },
      }
    }
  }
  
  const { data } = json
  const tierFeatures = data.tierInfo?.features || {} as Record<string, number | boolean>
  const hasPremium = data.tier !== 'FREE'
  
  // Tier-specific limits based on pricing structure
  // FREE: 2 children, 30 days history
  // PREMIUM (Basic): 5 children, 90 days history, SMS notifications
  // PREMIUM_PLUS (Premium): unlimited children, 365 days history, phone alerts
  const tierLimits = {
    FREE: { maxChildren: 2, historyDays: 30 },
    PREMIUM: { maxChildren: 5, historyDays: 90 },
    PREMIUM_PLUS: { maxChildren: -1, historyDays: 365 }, // -1 = unlimited
  }
  
  const currentTierLimits = tierLimits[data.tier as keyof typeof tierLimits] || tierLimits.FREE
  
  return {
    subscription: data.id ? {
      id: data.id,
      familyId: '', // will be filled by context
      tier: data.tier as Subscription['tier'],
      status: data.status as Subscription['status'],
      currentPeriodStart: data.currentPeriodStart || null,
      currentPeriodEnd: data.currentPeriodEnd || null,
      trialEnd: data.trialEndsAt || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    } : null,
    access: {
      hasPremium,
      tier: data.tier,
      features: data.tierInfo?.featureList || [],
      limits: {
        maxChildren: currentTierLimits.maxChildren,
        historyDays: currentTierLimits.historyDays,
        maxSavedPlaces: (tierFeatures.maxSavedPlaces as number) || 5,
        maxFamilyMembers: (tierFeatures.maxFamilyMembers as number) || 4,
        maxCalendars: (tierFeatures.maxCalendars as number) || 2,
      },
    },
  }
}

export function useSubscription(familyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{
    subscription: Subscription | null
    access: PremiumAccess
  }>(
    familyId ? `/api/subscriptions?familyId=${familyId}` : null,
    fetcher
  )
  
  const startTrial = useCallback(async () => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const res = await authFetch(`/api/subscriptions/${familyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_trial' }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true, subscription: data.subscription }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [familyId, mutate])
  
  const cancelSubscription = useCallback(async (): Promise<{ 
    success: boolean; 
    error?: string; 
    data?: { ticketNumber?: string; ticketId?: string; currentPeriodEnd?: string } 
  }> => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const res = await authFetch(`/api/subscriptions/${familyId}`, {
        method: 'DELETE',
      })
      
      const responseData = await res.json()
      
      if (!res.ok) {
        return { success: false, error: responseData.error }
      }
      
      await mutate()
      return { 
        success: true, 
        data: {
          ticketNumber: responseData.data?.ticketNumber,
          ticketId: responseData.data?.ticketId,
          currentPeriodEnd: responseData.data?.currentPeriodEnd,
        }
      }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [familyId, mutate])
  
  const canUseFeature = useCallback((feature: string) => {
    if (!data?.access) return false
    return data.access.features.includes(feature)
  }, [data])
  
  return {
    subscription: data?.subscription || null,
    access: data?.access || {
      hasPremium: false,
      tier: 'FREE',
      features: [],
      limits: { maxChildren: 2, historyDays: 30, maxSavedPlaces: 5, maxFamilyMembers: 4, maxCalendars: 2 },
    },
    isLoading,
    error,
    startTrial,
    cancelSubscription,
    canUseFeature,
    mutate,
  }
}

export function useSubscriptionTiers(): SubscriptionTierInfo[] {
  return [
    {
      name: 'Free',
      description: 'Basic family coordination',
      price: { monthly: 0, annual: 0 },
      features: [
        'Up to 2 children',
        'Shared family calendar',
        'Basic event notifications',
        '30 days history',
        'Email support',
      ],
    },
    {
      name: 'Basic',
      description: 'Enhanced family features',
      price: { monthly: 3.99, annual: 39.90 },
      features: [
        'Up to 5 children',
        'Advanced reminder settings',
        'Complex recurring events',
        '90 days history',
        'SMS notifications',
        'Priority support',
      ],
    },
    {
      name: 'Premium',
      description: 'Full family safety suite',
      price: { monthly: 7.99, annual: 79.90 },
      features: [
        'Unlimited children',
        'Real-time location sharing',
        'Geofence alerts',
        '1 year history',
        'Phone alert notifications',
        'Custom reminder times',
        'Family activity reports',
        '24/7 priority support',
      ],
    },
  ]
}
