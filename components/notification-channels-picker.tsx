'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Bell } from 'lucide-react'

// Mirrors NotificationChannel in lib/services/notification-dispatcher.ts
// (kept as a plain string union here, not imported, to avoid pulling a
// server-only module with DB/Twilio/Resend/Firebase imports into client
// bundles).
export const NOTIFICATION_CHANNEL_OPTIONS = [
  { value: 'in_app', label: 'In-app', description: 'Shows in their Togethr notifications feed' },
  { value: 'push', label: 'Push', description: 'Phone push notification' },
  { value: 'email', label: 'Email', description: 'Sent to their email address' },
  { value: 'sms', label: 'Text (SMS)', description: 'Sent as a text message' },
] as const

export type NotificationChannelValue = (typeof NOTIFICATION_CHANNEL_OPTIONS)[number]['value']

interface NotificationChannelsPickerProps {
  selected: NotificationChannelValue[]
  onChange: (channels: NotificationChannelValue[]) => void
  label?: string
  helpText?: string
}

/**
 * Multi-select pick list for which notification channel(s) the
 * assignee/participants should receive for this specific task or event.
 * Leaving everything unchecked (the default) means "don't override -
 * use whatever the recipient already set in their own notification
 * settings."
 */
export function NotificationChannelsPicker({
  selected,
  onChange,
  label = 'Notify via',
  helpText = "Leave unchecked to use each person's own notification settings.",
}: NotificationChannelsPickerProps) {
  const toggle = (value: NotificationChannelValue) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        <Bell className="h-4 w-4 inline mr-1" />
        {label}
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {NOTIFICATION_CHANNEL_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="flex items-start gap-2 p-2 rounded-md border border-border"
          >
            <Checkbox
              id={`notify-channel-${opt.value}`}
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              className="mt-0.5"
            />
            <label htmlFor={`notify-channel-${opt.value}`} className="cursor-pointer">
              <div className="text-sm font-medium leading-none">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
            </label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{helpText}</p>
    </div>
  )
}
