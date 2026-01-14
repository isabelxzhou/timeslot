'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, differenceInMinutes, startOfDay } from 'date-fns'
import Button from '@/components/ui/Button'
import Logo from '@/components/ui/Logo'
import DynamicBackground from '@/components/ui/DynamicBackground'

interface Booking {
  id: string
  guest_name: string
  guest_email: string
  message: string | null
  start_time: string
  end_time: string
  status: string
  created_at: string
}

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

export default function AdminPage() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  const hours = Array.from({ length: 12 }, (_, i) => i + 8)

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
        fetchBookings()
      } else {
        setAuthenticated(false)
        router.push('/admin/login')
      }
    } catch {
      setAuthenticated(false)
      router.push('/admin/login')
    }
  }

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings?upcoming=true')
      if (response.ok) {
        const data = await response.json()
        setBookings(data.bookings || [])
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEvents = async () => {
    setCalendarLoading(true)
    try {
      const weekStart = currentWeek
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 })
      const response = await fetch(
        `/api/calendar-events?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      )
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
        setAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    try {
      const response = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' })
      })
      if (response.ok) {
        fetchBookings()
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/admin/login')
  }

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start)
      return isSameDay(eventStart, day)
    })
  }

  const getEventStyle = (event: CalendarEvent) => {
    const start = parseISO(event.start)
    const end = parseISO(event.end)
    const dayStart = new Date(start)
    dayStart.setHours(8, 0, 0, 0)
    const startMinutes = differenceInMinutes(start, dayStart)
    const durationMinutes = differenceInMinutes(end, start)
    const top = Math.max(0, (startMinutes / 60) * 48)
    const height = Math.max((durationMinutes / 60) * 48, 18)
    return { top: `${top}px`, height: `${height}px`, backgroundColor: event.color }
  }

  if (authenticated === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin h-8 w-8 border-2 border-zinc-700 border-t-white rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-zinc-100 relative">
      <DynamicBackground />
      <header className="border-b border-zinc-800/50 sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo href="/" />
          <div className="flex items-center gap-6">
            <a href="/admin/settings" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Settings
            </a>
            <button onClick={handleLogout} className="text-sm text-zinc-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Booking Link Card */}
        <div className="mb-8 bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-white mb-1">Your Booking Link</h2>
              <p className="text-zinc-500 text-sm">Share this link to let people book time with you</p>
            </div>
            <div className="flex items-center gap-3">
              <code className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-300 text-sm font-mono">
                {process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/book
              </code>
              <button
                onClick={() => {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                  navigator.clipboard.writeText(`${baseUrl}/book`)
                  alert('Copied!')
                }}
                className="px-4 py-2 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">My Calendar</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-zinc-300 min-w-[180px] text-center">
                {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Calendar Legend */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm">
              {accounts.map(account => (
                <div key={account.email} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: account.color }} />
                  <span className="text-zinc-400">{account.email}</span>
                </div>
              ))}
            </div>
          )}

          {/* Calendar Grid */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {calendarLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-6 w-6 border-2 border-zinc-700 border-t-white rounded-full" />
              </div>
            ) : (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-8 border-b border-zinc-800">
                  <div className="w-14 border-r border-zinc-800" />
                  {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div key={i} className={`py-3 text-center border-r border-zinc-800 ${isToday ? 'bg-zinc-800' : ''}`}>
                        <div className="text-xs text-zinc-500 uppercase">{format(day, 'EEE')}</div>
                        <div className={`text-lg font-semibold ${isToday ? 'text-white' : 'text-zinc-400'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Time Grid */}
                <div className="grid grid-cols-8 max-h-[500px] overflow-y-auto">
                  <div className="border-r border-zinc-800">
                    {hours.map(hour => (
                      <div key={hour} className="h-[48px] border-b border-zinc-800/50 relative">
                        <span className="absolute -top-2 right-2 text-xs text-zinc-600">
                          {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const dayEvents = getEventsForDay(day)
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div key={dayIndex} className={`border-r border-zinc-800 relative ${isToday ? 'bg-zinc-800/30' : ''}`}>
                        {hours.map(hour => (
                          <div key={hour} className="h-[48px] border-b border-zinc-800/50" />
                        ))}
                        {dayEvents.filter(e => !e.allDay).map(event => {
                          const start = parseISO(event.start)
                          if (start.getHours() < 8 || start.getHours() >= 20) return null
                          return (
                            <div
                              key={event.id}
                              className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-white overflow-hidden opacity-90 hover:opacity-100"
                              style={getEventStyle(event)}
                              title={`${event.title} (${event.calendarEmail})`}
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              <div className="opacity-75 text-[10px]">{format(start, 'h:mm a')}</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Upcoming Bookings</h2>
          {bookings.length === 0 ? (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
              <p className="text-zinc-500">No upcoming bookings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(booking => (
                <div key={booking.id} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-white">{booking.guest_name}</h3>
                      <p className="text-sm text-zinc-500">{booking.guest_email}</p>
                      <p className="text-sm text-zinc-400 mt-2">
                        {format(new Date(booking.start_time), 'EEEE, MMM d')} at {format(new Date(booking.start_time), 'h:mm a')}
                      </p>
                      {booking.message && (
                        <p className="text-sm text-zinc-500 mt-2 bg-zinc-800 p-2 rounded">{booking.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        booking.status === 'confirmed' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {booking.status}
                      </span>
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="px-3 py-1 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
