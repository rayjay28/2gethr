'use client'

import useSWR from 'swr'
import { useCallback, useState } from 'react'
import { getAccessToken } from './use-auth'

export interface CalendarSyncConnection {
  id: string
  provider: 'google' | 'apple'
  calendarName: string
  externalCalendarId: string
  syncEnabled: boolean
  syncDirection: 'import' | 'export' | 'both'
  syncTasks: boolean
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

const fetcher = async (url: string) => {
  const token = getAccessToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function useCalendarSync() {
  const { data, error, isLoading, mutate } = useSWR<{ connections: CalendarSyncConnection[] }>(
    '/api/calendar-sync/connections',
    fetcher
  )

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const connectGoogle = useCallback(async () => {
    const token = getAccessToken()
    const res = await fetch('/api/calendar-sync/google/auth', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    
    if (data.success && data.authUrl) {
      window.location.href = data.authUrl
    } else {
      throw new Error(data.error || 'Failed to start Google auth')
    }
  }, [])

  const disconnect = useCallback(async (connectionId: string) => {
    const token = getAccessToken()
    const res = await fetch('/api/calendar-sync/connections', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ connectionId }),
    })
    
    if (res.ok) {
      mutate()
    } else {
      const data = await res.json()
      throw new Error(data.error || 'Failed to disconnect')
    }
  }, [mutate])

  const updateConnection = useCallback(async (
    connectionId: string,
    updates: { syncEnabled?: boolean; syncDirection?: string }
  ) => {
    const token = getAccessToken()
    const res = await fetch('/api/calendar-sync/connections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ connectionId, ...updates }),
    })
    
    if (res.ok) {
      mutate()
    } else {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update connection')
    }
  }, [mutate])

  const syncNow = useCallback(async (provider: 'google') => {
    setIsSyncing(true)
    setSyncError(null)

    try {
      const token = getAccessToken()
      const res = await fetch(`/api/calendar-sync/${provider}/sync`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      mutate()
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setSyncError(message)
      throw err
    } finally {
      setIsSyncing(false)
    }
  }, [mutate])

  const googleConnection = data?.connections?.find(c => c.provider === 'google')

  return {
    connections: data?.connections || [],
    googleConnection,
    isLoading,
    error,
    isSyncing,
    syncError,
    connectGoogle,
    disconnect,
    updateConnection,
    syncNow,
    refresh: mutate,
  }
}
