'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  differenceInMinutes,
  startOfDay,
} from 'date-fns'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  calendarEmail: string
  color: string
}

interface AccountInfo {
  email: string
  color: string
}

interface CalendarResponse {
  events: CalendarEvent[]
  accounts: AccountInfo[]
  error?: string
  apiNotEnabled?: boolean
}

export default function AdminCalendarPage() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchEvents()
    }
  }, [authenticated, currentWeek])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
        router.push('/admin/login')
      }
    } catch {
      setAuthenticated(false)
      router.push('/admin/login')
    }
  }

  const fetchEvents = async () => {
    setLoading(true)
    setApiError(null)
    try {
      const weekStart = currentWeek
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 })

      const response = await fetch(
        `/api/calendar-events?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      )

      if (response.ok) {
        const data: CalendarResponse = await response.json()
        if (data.apiNotEnabled) {
          setApiError('Google Calendar API is not enabled. Please enable it in your Google Cloud Console.')
        } else {
          setEvents(data.events || [])
          setAccounts(data.accounts || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start)
      return isSameDay(eventStart, day)
    })
  }

  const getEventStyle = (event: CalendarEvent) => {
    const start = parseISO(event.start)
    const end = parseISO(event.end)
    const dayStart = startOfDay(start)

    const startMinutes = differenceInMinutes(start, dayStart)
    const durationMinutes = differenceInMinutes(end, start)

    const top = (startMinutes / 60) * 60 // 60px per hour
    const height = Math.max((durationMinutes / 60) * 60, 20) // minimum 20px

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: event.color,
    }
  }

  if (authenticated === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-600 hover:text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-xl font-bold text-gray-900">My Calendar</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              Today
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* API Error Message */}
      {apiError && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-orange-800">Calendar API Not Enabled</h3>
                <p className="text-sm text-orange-700 mt-1">
                  To see your calendar events, enable the Google Calendar API:
                </p>
                <ol className="text-sm text-orange-700 mt-2 list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console - Calendar API</a></li>
                  <li>Click "Enable"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Legend */}
      {accounts.length > 0 && (
        <div className="bg-white border-b px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-4 text-sm">
            <span className="text-gray-500">Calendars:</span>
            {accounts.map(account => (
              <div key={account.email} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                <span className="text-gray-700">{account.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="max-w-7xl mx-auto">
        {/* Day Headers */}
        <div className="grid grid-cols-8 bg-white border-b sticky top-[73px] z-10">
          <div className="w-16 border-r" /> {/* Time column spacer */}
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, new Date())
            return (
              <div
                key={i}
                className={`py-3 text-center border-r ${isToday ? 'bg-blue-50' : ''}`}
              >
                <div className="text-xs text-gray-500 uppercase">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time Grid */}
        <div className="grid grid-cols-8 bg-white">
          {/* Time Labels */}
          <div className="border-r">
            {hours.map(hour => (
              <div key={hour} className="h-[60px] border-b relative">
                <span className="absolute -top-2.5 right-2 text-xs text-gray-400">
                  {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={dayIndex}
                className={`border-r relative ${isToday ? 'bg-blue-50/30' : ''}`}
              >
                {/* Hour lines */}
                {hours.map(hour => (
                  <div key={hour} className="h-[60px] border-b border-gray-100" />
                ))}

                {/* Events */}
                {dayEvents.filter(e => !e.allDay).map(event => (
                  <div
                    key={event.id}
                    className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90"
                    style={getEventStyle(event)}
                    title={`${event.title} (${event.calendarEmail})`}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-white/80 truncate text-[10px]">
                      {format(parseISO(event.start), 'h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* All Day Events */}
        {events.some(e => e.allDay) && (
          <div className="bg-white border-t p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">All-Day Events</h3>
            <div className="flex flex-wrap gap-2">
              {events.filter(e => e.allDay).map(event => (
                <span
                  key={event.id}
                  className="px-2 py-1 rounded text-xs text-white"
                  style={{ backgroundColor: event.color }}
                >
                  {format(parseISO(event.start), 'MMM d')}: {event.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
