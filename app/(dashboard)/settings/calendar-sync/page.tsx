'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Trash2, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useCalendarSync } from '@/hooks/use-calendar-sync'
import { format } from 'date-fns'

// Google Calendar icon
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4Z" fill="#FFFFFF" stroke="#4285F4" strokeWidth="2"/>
      <path d="M16 2V6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 2V6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 10H20" stroke="#4285F4" strokeWidth="2"/>
      <rect x="7" y="13" width="3" height="3" fill="#EA4335"/>
      <rect x="11" y="13" width="3" height="3" fill="#FBBC05"/>
      <rect x="15" y="13" width="3" height="3" fill="#34A853"/>
    </svg>
  )
}



export default function CalendarSyncPage() {
  const searchParams = useSearchParams()
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const {
    googleConnection,
    isLoading,
    isSyncing,
    connectGoogle,
    disconnect,
    updateConnection,
    syncNow,
  } = useCalendarSync()

  const [taskSyncEnabled, setTaskSyncEnabled] = useState(false)
  const [isTogglingTaskSync, setIsTogglingTaskSync] = useState(false)

  // Initialize task sync state from connection
  useEffect(() => {
    if (googleConnection?.syncTasks !== undefined) {
      setTaskSyncEnabled(googleConnection.syncTasks)
    }
  }, [googleConnection?.syncTasks])

  const handleToggleTaskSync = async (enabled: boolean) => {
    setIsTogglingTaskSync(true)
    try {
      const res = await fetch('/api/calendar-sync/google/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncTasks: enabled }),
      })
      const data = await res.json()
      if (data.success) {
        setTaskSyncEnabled(enabled)
        setStatusMessage({ 
          type: 'success', 
          message: enabled ? 'Task sync enabled - tasks will sync to Google Tasks' : 'Task sync disabled' 
        })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to update task sync' 
      })
    } finally {
      setIsTogglingTaskSync(false)
    }
  }

  const handleSyncTasksNow = async () => {
    try {
      const res = await fetch('/api/calendar-sync/google/tasks', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setStatusMessage({ type: 'success', message: data.message })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to sync tasks' 
      })
    }
  }

  // Handle URL params for success/error messages
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'google') {
      setStatusMessage({ type: 'success', message: 'Google Calendar connected successfully!' })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        denied: 'Calendar access was denied',
        missing_params: 'Missing required parameters',
        invalid_state: 'Invalid authentication state',
        token_exchange: 'Failed to exchange token',
        callback_failed: 'Callback processing failed',
      }
      setStatusMessage({ type: 'error', message: errorMessages[error] || 'Connection failed' })
    }

    // Clear message after 5 seconds
    if (success || error) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  const handleConnectGoogle = async () => {
    try {
      await connectGoogle()
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to connect Google Calendar' 
      })
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return
    }

    try {
      await disconnect(connectionId)
      setStatusMessage({ type: 'success', message: 'Google Calendar disconnected' })
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to disconnect' 
      })
    }
  }

  const handleSyncNow = async () => {
    try {
      const result = await syncNow('google')
      setStatusMessage({ type: 'success', message: result.message })
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Sync failed' 
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 h-9 w-9 sm:h-10 sm:w-10">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Calendar Sync</h1>
          <p className="text-sm text-muted-foreground">Connect external calendars for automatic sync</p>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-lg ${
          statusMessage.type === 'success' 
            ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
            : 'bg-red-500/10 text-red-600 border border-red-500/20'
        }`}>
          {statusMessage.message}
        </div>
      )}

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <GoogleCalendarIcon className="w-8 h-8" />
            <div>
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <CardDescription>
                Sync events bidirectionally with Google Calendar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleConnection ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{googleConnection.calendarName}</p>
                  <p className="text-sm text-muted-foreground">
                    {googleConnection.lastSyncedAt 
                      ? `Last synced: ${format(new Date(googleConnection.lastSyncedAt), 'MMM d, yyyy h:mm a')}`
                      : 'Never synced'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Spinner className="w-4 h-4 mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDisconnect(googleConnection.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sync Enabled</p>
                    <p className="text-sm text-muted-foreground">Automatically sync events</p>
                  </div>
                  <Switch 
                    checked={googleConnection.syncEnabled}
                    onCheckedChange={(checked) => 
                      updateConnection(googleConnection.id, { syncEnabled: checked })
                    }
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Sync Direction</p>
                    <p className="text-sm text-muted-foreground">Choose how events are synced</p>
                  </div>
                  <Select 
                    value={googleConnection.syncDirection}
                    onValueChange={(value) => 
                      updateConnection(googleConnection.id, { syncDirection: value })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import">Import only</SelectItem>
                      <SelectItem value="export">Export only</SelectItem>
                      <SelectItem value="bidirectional">Bidirectional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ListTodo className="w-5 h-5 text-muted-foreground" />
                    <p className="font-medium">Task Sync to Google Tasks</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sync your Togethr tasks with due dates to Google Tasks. 
                    Tasks will appear in the Google Tasks app and show as reminders on your Android phone.
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={taskSyncEnabled}
                        onCheckedChange={handleToggleTaskSync}
                        disabled={isTogglingTaskSync}
                      />
                      <span className="text-sm">
                        {taskSyncEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {taskSyncEnabled && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSyncTasksNow}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Tasks Now
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Button onClick={handleConnectGoogle} className="w-full sm:w-auto">
              <GoogleCalendarIcon className="w-5 h-5 mr-2" />
              Connect Google Calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">About Calendar Sync</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Google Calendar:</strong> Full bidirectional sync - events flow both ways automatically</li>
            <li>• <strong>Google Tasks:</strong> Tasks with due dates sync to Google Tasks app and appear as reminders on Android</li>
            <li>• Sync runs automatically every 15 minutes when enabled</li>
            <li>• Your calendar credentials are encrypted and stored securely</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
