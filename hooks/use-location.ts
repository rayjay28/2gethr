'use client'

import useSWR from 'swr'
import { useCallback } from 'react'

export interface SavedPlace {
  id: string
  familyId: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  category: string
  geofenceEnabled: boolean
  notifyOnArrival: boolean
  notifyOnDeparture: boolean
  createdAt: string
}

export interface LocationSettings {
  id: string
  childProfileId: string
  memberId?: string
  familyId?: string
  sharingEnabled: boolean
  shareMode: 'OFF' | 'ACTIVE' | 'PAUSED'
  shareWithFamily?: boolean
  updateIntervalMinutes: number
  updateIntervalSec?: number
  retentionDays: number
  pausedUntil: string | null
}

export interface LocationPing {
  id: string
  childProfileId: string
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  speed: number | null
  heading: number | null
  recordedAt: string
}

export interface GeofenceEvent {
  id: string
  childProfileId: string
  placeId: string
  eventType: 'ARRIVAL' | 'DEPARTURE'
  latitude: number
  longitude: number
  recordedAt: string
  place?: SavedPlace
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    throw new Error('Failed to fetch')
  }
  return res.json()
}

export function useSavedPlaces(familyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ places: SavedPlace[] }>(
    familyId ? `/api/places?familyId=${familyId}` : null,
    fetcher
  )
  
  const createPlace = useCallback(async (placeData: {
    familyId: string
    name: string
    address?: string
    latitude: number
    longitude: number
    radiusMeters?: number
    category?: string
    geofenceEnabled?: boolean
    notifyOnArrival?: boolean
    notifyOnDeparture?: boolean
  }) => {
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(placeData),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true, place: data.place }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  return {
    places: data?.places || [],
    isLoading,
    error,
    createPlace,
    mutate,
  }
}

export function useChildLocation(childProfileId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{
    settings: LocationSettings | null
    lastPing: LocationPing | null
    recentGeofenceEvents: GeofenceEvent[]
  }>(
    childProfileId ? `/api/location?childProfileId=${childProfileId}` : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
    }
  )
  
  const updateSettings = useCallback(async (updates: Partial<LocationSettings>) => {
    if (!childProfileId) return { success: false, error: 'No child selected' }
    
    try {
      const res = await fetch('/api/location/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ childProfileId, ...updates }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [childProfileId, mutate])
  
  const pauseSharing = useCallback(async (hours: number) => {
    if (!childProfileId) return { success: false, error: 'No child selected' }
    
    const pausedUntil = new Date()
    pausedUntil.setHours(pausedUntil.getHours() + hours)
    
    return updateSettings({ pausedUntil: pausedUntil.toISOString() })
  }, [childProfileId, updateSettings])
  
  const resumeSharing = useCallback(async () => {
    if (!childProfileId) return { success: false, error: 'No child selected' }
    
    return updateSettings({ pausedUntil: null })
  }, [childProfileId, updateSettings])
  
  return {
    settings: data?.settings || null,
    lastPing: data?.lastPing || null,
    recentGeofenceEvents: data?.recentGeofenceEvents || [],
    isLoading,
    error,
    updateSettings,
    pauseSharing,
    resumeSharing,
    mutate,
  }
}
