'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/hooks/use-auth'

interface PushNotificationState {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  permission: NotificationPermission | null
  error: string | null
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
    error: null
  })

  useEffect(() => {
    checkSupport()
  }, [])

  const checkSupport = async () => {
    // Check if browser supports push notifications
    const isSupported = 
      'serviceWorker' in navigator && 
      'PushManager' in window && 
      'Notification' in window

    if (!isSupported) {
      setState(prev => ({
        ...prev,
        isSupported: false,
        isLoading: false,
        error: 'Push notifications not supported in this browser'
      }))
      return
    }

    try {
      const permission = Notification.permission
      
      // Check if already subscribed
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      setState({
        isSupported: true,
        isSubscribed: !!subscription,
        isLoading: false,
        permission,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSupported: true,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check subscription status'
      }))
    }
  }

  // Returns { success, error } instead of a bare boolean. The caller
  // (Settings page) used to read `pushNotifications.error` right after
  // awaiting this function to decide what toast to show, but that reads a
  // stale closure of the hook's state from before this call's setState took
  // effect, so the real error (whatever actually failed - permission,
  // subscribe, or the server POST) was never shown; the toast always fell
  // back to the generic "Failed to enable push notifications" text no
  // matter what went wrong. Returning the error directly lets the caller
  // show the real message.
  const subscribe = useCallback(async (): Promise<{ success: boolean; error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Request permission
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        const message = 'Notification permission denied'
        setState(prev => ({
          ...prev,
          isLoading: false,
          permission,
          error: message
        }))
        return { success: false, error: message }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // BUG FIX: if a subscription already exists (e.g. from before a VAPID
      // key rotation, or one created without an applicationServerKey via the
      // old fallback branch below), calling pushManager.subscribe() again
      // throws "InvalidStateError: A subscription with a different
      // applicationServerKey (or gcm_sender_id) already exists" because a
      // service worker registration can only hold one subscription at a
      // time. That error was being caught below and surfaced only as a
      // generic failure, so the UI toggle just silently reverted - this is
      // why a stale subscription (e.g. a phone's old push registration)
      // blocked ever re-subscribing. Unsubscribe any existing subscription
      // first so a fresh one can always be created.
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        await existingSubscription.unsubscribe()
      }

      // REBUILD NOTE: this used to silently fall back to
      // `pushManager.subscribe({ userVisibleOnly: true })` with no
      // applicationServerKey when NEXT_PUBLIC_VAPID_PUBLIC_KEY wasn't
      // present client-side (a leftover from when this app spoke to
      // Firebase Cloud Messaging, which could mint a sender ID on its own).
      // There is no Firebase here anymore and no `gcm_sender_id` in
      // manifest.json, so that fallback has nothing to fall back to -
      // modern Chrome requires an applicationServerKey for a first-time
      // subscription and throws (commonly an AbortError or NotSupportedError
      // whose message doesn't mention VAPID at all) if neither is present.
      // That's a config problem (NEXT_PUBLIC_VAPID_PUBLIC_KEY missing from
      // THIS build), not a per-device one, so fail with a message that says
      // so instead of letting the browser's generic error reach the toast.
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        const message = 'Push is not configured for this build (missing VAPID public key) - this is a server configuration issue, not something fixable on this device.'
        setState(prev => ({ ...prev, isLoading: false, error: message }))
        return { success: false, error: message }
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      })

      // Send subscription to server
      const response = await authFetch('/api/notifications/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: JSON.stringify(subscription),
          platform: 'web',
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language
          }
        })
      })

      if (!response.ok) {
        // Include the server's status/body so the toast can show something
        // more useful than a bare "Failed to register push token" when this
        // is the actual failure point (e.g. a 401 from an expired session,
        // or a validation error from the API route).
        const bodyText = await response.text().catch(() => '')
        throw new Error(`Failed to register push token (${response.status}): ${bodyText || 'no response body'}`)
      }

      setState({
        isSupported: true,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
        error: null
      })

      return { success: true, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to subscribe'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message
      }))
      return { success: false, error: message }
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Notify server to remove token
        await authFetch('/api/notifications/push-token', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: JSON.stringify(subscription)
          })
        })
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null
      }))

      return true
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe'
      }))
      return false
    }
  }, [])

  return {
    ...state,
    subscribe,
    unsubscribe,
    refresh: checkSupport
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
