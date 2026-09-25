'use client'

// Re-export client-side admin auth utilities from the hook
export { 
  getAdminAccessToken, 
  setAdminTokens, 
  clearAdminTokens, 
  getAdminRefreshToken 
} from '@/hooks/use-admin-auth'
