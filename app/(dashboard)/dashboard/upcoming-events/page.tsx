'use client'

import { useState, useMemo } from 'react'
import { useFamilies } from '@/hooks/use-family'
import { useEvents, Event } from '@/hooks/use-events'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { Calendar, Clock, MapPin, Plus, ArrowLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO, addDays, isAfter, isToday, isTomorrow } from 'date-fns'

export default function UpcomingEventsPage() {
  const { families, isLoading: familiesLoading } = useFamilies()
  const primaryFamily = families[0]
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow'>('all')
  
  // Memoize dates to prevent infinite re-renders (SWR key stability)
  const dateRange = useMemo(() => {
    const now = new Date()
    const thirtyDaysFromNow = addDays(now, 30)
    return {
      startDate: now.toISOString(),
      endDate: thirtyDaysFromNow.toISOString(),
    }
  }, [])
  
  const { events, isLoading: eventsLoading } = useEvents(
    primaryFamily?.id ? {
      familyId: primaryFamily.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    } : {}
  )

  // Filter to only future events
  const allUpcomingEvents = useMemo(() => {
    if (!events || events.length === 0) return []
    const currentTime = new Date()
    return events
      .filter((event: Event) => isAfter(parseISO(event.startTime), currentTime))
      .sort((a: Event, b: Event) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
  }, [events])

  // Apply filter
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return allUpcomingEvents
    return allUpcomingEvents.filter((event: Event) => {
      const eventStart = parseISO(event.startTime)
      if (filter === 'today') return isToday(eventStart)
      if (filter === 'tomorrow') return isTomorrow(eventStart)
      return true
    })
  }, [allUpcomingEvents, filter])

  // Counts
  const todayCount = allUpcomingEvents.filter(e => isToday(parseISO(e.startTime))).length
  const tomorrowCount = allUpcomingEvents.filter(e => isTomorrow(parseISO(e.startTime))).length

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      APPOINTMENT: 'bg-blue-500',
      SCHOOL: 'bg-purple-500',
      SPORTS: 'bg-green-500',
      BIRTHDAY: 'bg-pink-500',
      HOLIDAY: 'bg-red-500',
      FAMILY: 'bg-amber-500',
      WORK: 'bg-slate-500',
      OTHER: 'bg-gray-400',
    }
    return colors[(category || '').toUpperCase()] || colors.OTHER
  }

  if (familiesLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  if (!primaryFamily) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Empty title="No family yet" description="Create or join a family to view events" />
        <Button asChild className="mt-4">
          <Link href="/onboarding">Get Started</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-9 w-9">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Events</h1>
              <p className="text-xs text-muted-foreground">{allUpcomingEvents.length} upcoming</p>
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href="/calendar">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Link>
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              filter === 'all' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            All ({allUpcomingEvents.length})
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              filter === 'today' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            Today ({todayCount})
          </button>
          <button
            onClick={() => setFilter('tomorrow')}
            className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              filter === 'tomorrow' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            Tomorrow ({tomorrowCount})
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="p-4 pb-24">
        {eventsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-1">No events</p>
            <p className="text-sm text-muted-foreground/70">
              {filter === 'today' ? 'Nothing scheduled today' : 
               filter === 'tomorrow' ? 'Nothing scheduled tomorrow' : 
               'Your calendar is clear'}
            </p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href="/calendar">Add Event</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((event) => {
              const eventDate = parseISO(event.startTime)
              const isEventToday = isToday(eventDate)
              const isEventTomorrow = isTomorrow(eventDate)
              
              return (
                <Link
                  key={event.id}
                  href={`/calendar?date=${format(eventDate, 'yyyy-MM-dd')}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border active:bg-muted/50 transition-colors"
                >
                  {/* Color indicator */}
                  <div className={`w-1 self-stretch rounded-full ${getCategoryColor(event.category)}`} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(eventDate, 'h:mm a')}
                      </span>
                      <span>
                        {isEventToday ? 'Today' : isEventTomorrow ? 'Tomorrow' : format(eventDate, 'EEE, MMM d')}
                      </span>
                    </div>
                    {event.location && (
                      <p className="flex items-center gap-1 mt-1 text-xs text-muted-foreground truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {event.location}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
