'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Bell, Plus, Check, X, Trash2, Repeat, Clock } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { authFetch } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface Reminder {
  id: string
  title: string
  description?: string
  remind_at: string
  status: string
  is_recurring: boolean
  recurrence_rule: string | null
  sent_at: string | null
}

const RECURRENCE_OPTIONS = [
  { value: 'NONE', label: "Doesn't repeat" },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
]

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [recurrence, setRecurrence] = useState('NONE')

  const fetchReminders = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/reminders')
      if (res.ok) {
        const data = await res.json()
        setReminders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setRemindAt('')
    setRecurrence('NONE')
  }

  const handleCreate = async () => {
    if (!title.trim() || !remindAt) return
    setIsSaving(true)
    try {
      const res = await authFetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          remindAt: new Date(remindAt).toISOString(),
          isRecurring: recurrence !== 'NONE',
          recurrenceRule: recurrence !== 'NONE' ? recurrence : undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReminders(prev => [...prev, data.data].sort((a, b) => a.remind_at.localeCompare(b.remind_at)))
        resetForm()
        setDialogOpen(false)
      }
    } catch (error) {
      console.error('Failed to create reminder:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleComplete = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await authFetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to complete reminder:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDismiss = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await authFetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to dismiss reminder:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reminder permanently?')) return
    setProcessingId(id)
    try {
      const res = await authFetch(`/api/reminders/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete reminder:', error)
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Reminders</h1>
            <p className="text-sm text-muted-foreground">
              Quick reminders that aren&apos;t tied to a task or event
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="reminder-title">Title</Label>
                <Input
                  id="reminder-title"
                  placeholder="Take medication"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reminder-description">Notes (optional)</Label>
                <Textarea
                  id="reminder-description"
                  placeholder="Any extra details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reminder-time">Remind me at</Label>
                <Input
                  id="reminder-time"
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reminder-recurrence">Repeat</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger id="reminder-recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || !remindAt || isSaving}
                className="w-full"
              >
                {isSaving ? <Spinner className="w-4 h-4" /> : 'Create reminder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No reminders yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => {
            const due = parseISO(reminder.remind_at)
            const overdue = isPast(due) && reminder.status === 'PENDING'
            return (
              <div
                key={reminder.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
              >
                <button
                  onClick={() => handleComplete(reminder.id)}
                  disabled={processingId === reminder.id}
                  aria-label="Mark complete"
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary flex-shrink-0 flex items-center justify-center transition-colors"
                >
                  <Check className="w-3 h-3 opacity-0 hover:opacity-100" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{reminder.title}</p>
                  {reminder.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{reminder.description}</p>
                  )}
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs mt-1.5',
                    overdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    <Clock className="w-3 h-3" />
                    {format(due, "MMM d, h:mm a")}
                    {reminder.is_recurring && (
                      <span className="flex items-center gap-1 ml-1">
                        <Repeat className="w-3 h-3" />
                        {reminder.recurrence_rule?.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={processingId === reminder.id}
                    onClick={() => handleDismiss(reminder.id)}
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={processingId === reminder.id}
                    onClick={() => handleDelete(reminder.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
