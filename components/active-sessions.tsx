'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch, useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Laptop, Smartphone, Tablet, LogOut } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

// Lightweight, dependency-free device/browser summary from a User-Agent
// string. Good enough for "Chrome on macOS" style labels — not meant to be
// exhaustive, just readable.
function parseDevice(ua?: string | null): { label: string; type: 'mobile' | 'tablet' | 'desktop' } {
  if (!ua) return { label: 'Unknown device', type: 'desktop' }

  const isTablet = /iPad|Tablet/i.test(ua)
  const isMobile = !isTablet && /Mobi|Android|iPhone/i.test(ua)
  const type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  let os = 'an unknown OS'
  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Unknown browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

  return { label: `${browser} on ${os}`, type }
}

/**
 * Self-contained "Active Sessions" row + dialog for Settings > Security.
 * Replaces the previous "View Sessions" button, which had no onClick and
 * no backend behind it.
 */
export function ActiveSessions() {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)

  const load = async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/account/sessions')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to load sessions')
        return
      }
      setSessions(data.data || [])
    } catch {
      toast.error('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const openDialog = () => {
    setOpen(true)
    load()
  }

  const revoke = async (session: Session) => {
    setRevokingId(session.id)
    try {
      const res = await authFetch(`/api/account/sessions/${session.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to log out that session')
        return
      }
      if (data.wasCurrent) {
        toast.success('Logged out')
        setOpen(false)
        await logout()
        return
      }
      toast.success('Session logged out')
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
    } catch {
      toast.error('Network error')
    } finally {
      setRevokingId(null)
    }
  }

  const revokeOthers = async () => {
    setRevokingOthers(true)
    try {
      const res = await authFetch('/api/account/sessions/revoke-others', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to log out other sessions')
        return
      }
      toast.success('Logged out of all other sessions')
      setSessions((prev) => prev.filter((s) => s.isCurrent))
    } catch {
      toast.error('Network error')
    } finally {
      setRevokingOthers(false)
    }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Label>Active Sessions</Label>
          <p className="text-sm text-muted-foreground">Manage your active login sessions</p>
        </div>
        <Button variant="outline" onClick={openDialog}>View Sessions</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Active Sessions</DialogTitle>
            <DialogDescription>
              Devices currently signed in to your account.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active sessions found.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {sessions.map((session) => {
                const device = parseDevice(session.userAgent)
                const Icon = device.type === 'mobile' ? Smartphone : device.type === 'tablet' ? Tablet : Laptop
                return (
                  <div
                    key={session.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{device.label}</p>
                          {session.isCurrent && (
                            <Badge variant="secondary" className="text-xs">This device</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Signed in {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                          {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-100 shrink-0"
                      onClick={() => revoke(session)}
                      disabled={revokingId === session.id}
                    >
                      {revokingId === session.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : session.isCurrent ? (
                        'Log out'
                      ) : (
                        'Revoke'
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
            {otherCount > 0 && (
              <Button
                variant="outline"
                onClick={revokeOthers}
                disabled={revokingOthers}
                className="text-red-600 hover:text-red-700"
              >
                {revokingOthers ? (
                  <Spinner className="w-4 h-4 mr-2" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Log out other sessions ({otherCount})
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
