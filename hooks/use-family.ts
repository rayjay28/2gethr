'use client'

import useSWR from 'swr'
import { useCallback } from 'react'
import { getAccessToken } from './use-auth'

export interface FamilyMember {
  id: string
  userId: string
  familyId: string
  role: 'PARENT' | 'GUARDIAN' | 'CHILD'
  displayName: string
  avatarUrl: string | null
  permissions: Record<string, boolean>
  isActive: boolean
  joinedAt: string
}

export interface ChildProfile {
  id: string
  familyId: string
  displayName: string
  birthDate: string | null
  avatarUrl: string | null
  grade: string | null
  permissions: {
    canCreateEvents: boolean
    requiresApproval: boolean
    canViewFamilyCalendar: boolean
    locationSharingEnabled: boolean
  }
  createdAt: string
}

export interface Family {
  id: string
  name: string
  ownerId: string
  inviteCode: string | null
  createdAt: string
  members: FamilyMember[]
  children: ChildProfile[]
}

const fetcher = async (url: string) => {
  const token = getAccessToken()
  const res = await fetch(url, { 
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    throw new Error('Failed to fetch')
  }
  return res.json()
}

export function useFamilies() {
  const { data, error, isLoading, mutate } = useSWR<{ families: Family[] }>('/api/families', fetcher)
  
  const createFamily = useCallback(async (name: string) => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true, family: data.family }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  const joinFamily = useCallback(async (inviteCode: string) => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/families/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ inviteCode }),
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
  }, [mutate])
  
  return {
    families: data?.families || [],
    isLoading,
    error,
    createFamily,
    joinFamily,
    mutate,
  }
}

export function useFamily(familyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ family: Family }>(
    familyId ? `/api/families/${familyId}` : null,
    fetcher
  )
  
  const updateFamily = useCallback(async (updates: { name?: string }) => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/families/${familyId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
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
  }, [familyId, mutate])
  
  const generateInviteCode = useCallback(async () => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/families/${familyId}/invite`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true, inviteCode: data.inviteCode }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [familyId, mutate])
  
  const addChild = useCallback(async (childData: {
    displayName: string
    birthDate?: string
    grade?: string
    permissions?: Partial<ChildProfile['permissions']>
    existingMemberId?: string // For assigning existing family members as children
  }) => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/families/${familyId}/children`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(childData),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true, child: data.child }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [familyId, mutate])
  
  const updateMember = useCallback(async (memberId: string, updates: {
    role?: 'PARENT' | 'GUARDIAN' | 'CHILD'
    permissions?: Record<string, boolean>
  }) => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/families/${familyId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
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
  }, [familyId, mutate])
  
  const removeMember = useCallback(async (memberId: string) => {
    if (!familyId) return { success: false, error: 'No family selected' }
    
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/families/${familyId}/members/${memberId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error }
      }
      
      await mutate()
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [familyId, mutate])
  
  return {
    family: data?.family || null,
    isLoading,
    error,
    updateFamily,
    generateInviteCode,
    addChild,
    updateMember,
    removeMember,
    mutate,
  }
}
