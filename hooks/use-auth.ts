'use client'

import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

// Token storage keys
const ACCESS_TOKEN_KEY = 'safe_link_access_token'
const REFRESH_TOKEN_KEY = 'safe_link_refresh_token'

// Token management utilities
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export interface User {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  timezone: string
  createdAt: string
  primaryFamily?: {
    id: string
    name: string
  } | null
  primaryFamilyRole?: string | null
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: Error | null
}

// Authenticated fetch helper
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  return fetch(url, { ...options, headers })
}

const fetcher = async (url: string) => {
  const token = getAccessToken()
  
  if (!token) {
    return null
  }
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!res.ok) {
    if (res.status === 401) {
      // Try to refresh token
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          if (refreshData.data?.tokens) {
            setTokens(refreshData.data.tokens.accessToken, refreshToken)
            // Retry the original request
            const retryRes = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${refreshData.data.tokens.accessToken}`,
              },
            })
            if (retryRes.ok) {
              return retryRes.json()
            }
          }
        }
      }
      clearTokens()
      return null
    }
    throw new Error('Failed to fetch user')
  }
  return res.json()
}

export function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: { email: string; password: string; displayName?: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  uploadPhoto: (file: File) => Promise<{ success: boolean; pathname?: string; error?: string }>
  mutate: () => void
} {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const { data, error, isLoading, mutate } = useSWR<{ user: User } | null>(
    mounted ? '/api/auth/me' : null, 
    fetcher, 
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  )
  
  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
  return { success: false, error: data.error || 'Login failed' }
  }
  
  // Store tokens from response
  if (data.data?.tokens?.accessToken) {
    const refreshToken = data.data.tokens.refreshToken || data.data.tokens.accessToken
    setTokens(data.data.tokens.accessToken, refreshToken)
  }
  
  // Force SWR to refetch
      await mutate(undefined, { revalidate: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  const register = useCallback(async (registerData: { email: string; password: string; displayName?: string; phone?: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' }
      }
      
      // Store tokens from response
      if (data.data?.tokens?.accessToken) {
        const refreshToken = data.data.tokens.refreshToken || data.data.tokens.accessToken
        setTokens(data.data.tokens.accessToken, refreshToken)
      }
      
      await mutate(undefined, { revalidate: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  const logout = useCallback(async () => {
    clearTokens()
    await mutate(null, false)
    router.push('/login')
  }, [mutate, router])
  
  const updateProfile = useCallback(async (profileData: Partial<User>) => {
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error || 'Update failed' }
      }
      
      await mutate()
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  const uploadPhoto = useCallback(async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const token = getAccessToken()
      const res = await fetch('/api/auth/profile/photo', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { success: false, error: data.error || 'Upload failed' }
      }
      
      await mutate()
      return { success: true, pathname: data.pathname }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }, [mutate])
  
  return {
    user: data?.user || null,
    isLoading: !mounted || isLoading,
    isAuthenticated: !!data?.user,
    error: error || null,
    login,
    register,
    logout,
    updateProfile,
    uploadPhoto,
    mutate,
  }
}
