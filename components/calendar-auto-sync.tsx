'use client'

import { useEffect, useRef } from 'react'
import { useCalendarSync } from '@/hooks/use-calendar-sync'

/**
 * Runs the calendar/task auto-sync loop in the background for as long as
 * the app is open, at whatever interval the user picked in
 * Settings > Calendar Sync (10/30/60 min — see
 * app/(dashboard)/settings/calendar-sync/page.tsx).
 *
 * Mounted once in the dashboard layout (not the calendar-sync settings
 * page itself) so auto-sync keeps running no matter which page of the app
 * the user is on, not just while they happen to have that settings page
 * open.
 *
 * There is deliberately no server-side cron doing this: Vercel Cron on
 * this project's plan only runs each job once/day (see
 * app/api/cron/reminders/route.ts), far too coarse for a 10-minute
 * interval, and a true always-on push sync would need a paid plan or an
 * external scheduler. This client-side timer is the realistic mechanism
 * for "while the app is open"; it renders nothing.
 */
export function CalendarAutoSync() {
  const { googleConnection, syncNow } = useCalendarSync()
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!googleConnection?.syncEnabled) return

    const intervalMs = (googleConnection.syncIntervalMinutes || 30) * 60 * 1000

    const tick = async () => {
      if (isSyncingRef.current) return // don't overlap a slow sync with the next tick
      isSyncingRef.current = true
      try {
        await syncNow('google')
      } catch {
        // syncNow already records syncError; auto-sync just quietly retries next tick.
      } finally {
        isSyncingRef.current = false
      }
    }

    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
    // Re-create the timer whenever the connection, its enabled flag, or its
    // chosen interval changes, so a settings change takes effect immediately.
  }, [googleConnection?.syncEnabled, googleConnection?.syncIntervalMinutes, syncNow])

  return null
}
