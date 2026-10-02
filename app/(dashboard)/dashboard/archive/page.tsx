'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, Archive, RotateCcw, Trash2, ListTodo, Calendar, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { authFetch } from '@/hooks/use-auth'

interface ArchivedTask {
  id: string
  title: string
  description?: string
  status: string
  priority?: string
  category?: string
  dueDate?: string
  updatedAt: string
  creatorName?: string
}

interface ArchivedEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime?: string
  location?: string
  updatedAt: string
  calendarName?: string
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'tasks' | 'events'>('all')
  const [tasks, setTasks] = useState<ArchivedTask[]>([])
  const [events, setEvents] = useState<ArchivedEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchArchivedItems = useCallback(async () => {
    setIsLoading(true)

    try {
      // Fetch archived tasks
      const tasksRes = await authFetch('/api/tasks/archive')
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData.tasks || [])
      }

      // Fetch archived events
      const eventsRes = await authFetch('/api/events?status=ARCHIVED')
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        setEvents(eventsData.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch archived items:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchivedItems()
  }, [fetchArchivedItems])

  const handleRestoreTask = async (taskId: string) => {
    setProcessingId(taskId)

    try {
      const res = await authFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive' }),
      })

      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId))
      }
    } catch (error) {
      console.error('Failed to restore task:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to permanently delete this task?')) return
    
    setProcessingId(taskId)

    try {
      const res = await authFetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId))
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRestoreEvent = async (eventId: string) => {
    setProcessingId(eventId)

    try {
      // events.status is a Postgres enum whose only valid values are
      // PENDING/APPROVED/REJECTED/CANCELLED/ARCHIVED - there is no
      // CONFIRMED (same bug as the reminder cron had). APPROVED is the
      // normal non-archived status, so that's what "restore" should set.
      const res = await authFetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    } catch (error) {
      console.error('Failed to restore event:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to permanently delete this event?')) return
    
    setProcessingId(eventId)

    try {
      const res = await authFetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const filteredTasks = activeTab === 'events' ? [] : tasks
  const filteredEvents = activeTab === 'tasks' ? [] : events
  const totalCount = tasks.length + events.length
  const isEmpty = filteredTasks.length === 0 && filteredEvents.length === 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Archive</h1>
            <p className="text-sm text-muted-foreground">{totalCount} items</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
        >
          All
        </Button>
        <Button
          variant={activeTab === 'tasks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('tasks')}
        >
          <ListTodo className="w-4 h-4 mr-1" />
          Tasks ({tasks.length})
        </Button>
        <Button
          variant={activeTab === 'events' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('events')}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Events ({events.length})
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Archive className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No archived items</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Completed tasks and past events will appear here when archived
          </p>
        </div>
      )}

      {/* Archived Tasks */}
      {filteredTasks.length > 0 && (
        <div className="space-y-2">
          {activeTab === 'all' && (
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Tasks
            </h3>
          )}
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-card border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Archived {format(parseISO(task.updatedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleRestoreTask(task.id)}
                    disabled={processingId === task.id}
                  >
                    {processingId === task.id ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={processingId === task.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Events */}
      {filteredEvents.length > 0 && (
        <div className="space-y-2">
          {activeTab === 'all' && (
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mt-4">
              <Calendar className="w-4 h-4" />
              Events
            </h3>
          )}
          <div className="space-y-2">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-card border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Calendar className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(event.startTime), 'MMM d, yyyy')}
                      {event.location && ` • ${event.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleRestoreEvent(event.id)}
                    disabled={processingId === event.id}
                  >
                    {processingId === event.id ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={processingId === event.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
