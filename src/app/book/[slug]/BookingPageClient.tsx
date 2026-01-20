'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO, differenceInMinutes, startOfDay } from 'date-fns'
import BookingForm from '@/components/booking/BookingForm'
import Logo from '@/components/ui/Logo'
import DynamicBackground from '@/components/ui/DynamicBackground'

interface TimeSlot {
  start: string
  end: string
  available: boolean
  busy?: boolean // true if blocked by Google Calendar event
}

interface DaySlots {
  date: string
  slots: TimeSlot[]
}

interface MergedBlock {
  start: string
  end: string
  busy: boolean
}

// Merge overlapping/adjacent busy blocks only (actual calendar events, not just past times)
function mergeBusyBlocks(slots: TimeSlot[]): MergedBlock[] {
  // Filter for slots that are actually busy from calendar (not just past)
  const busySlots = slots.filter(s => s.busy === true)
  if (busySlots.length === 0) return []

  const sortedBusy = [...busySlots].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  const mergedBusy: MergedBlock[] = []
  let currentBlock = { start: sortedBusy[0].start, end: sortedBusy[0].end, busy: true }

  for (let i = 1; i < sortedBusy.length; i++) {
    const slot = sortedBusy[i]
    const currentEnd = new Date(currentBlock.end).getTime()
    const slotStart = new Date(slot.start).getTime()

    if (slotStart <= currentEnd + 60000) {
      const slotEnd = new Date(slot.end).getTime()
      if (slotEnd > currentEnd) {
        currentBlock.end = slot.end
      }
    } else {
      mergedBusy.push(currentBlock)
      currentBlock = { start: slot.start, end: slot.end, busy: true }
    }
  }
  mergedBusy.push(currentBlock)

  return mergedBusy
}

function isTimeRangeAvailable(startTime: Date, endTime: Date, busyBlocks: MergedBlock[]): boolean {
  for (const block of busyBlocks) {
    const blockStart = new Date(block.start).getTime()
    const blockEnd = new Date(block.end).getTime()
    const selStart = startTime.getTime()
    const selEnd = endTime.getTime()

    if (selStart < blockEnd && selEnd > blockStart) {
      return false
    }
  }
  return true
}

interface BookingPageClientProps {
  slug: string
  initialOwnerName?: string
}

export default function BookingPageClient({ slug, initialOwnerName }: BookingPageClientProps) {
  const router = useRouter()

  const [ownerName, setOwnerName] = useState<string>(initialOwnerName || '')
  const [ownerEmail, setOwnerEmail] = useState<string>('')
  const [notFound, setNotFound] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [weekSlots, setWeekSlots] = useState<DaySlots[]>([])
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; slot: TimeSlot } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragCurrentY, setDragCurrentY] = useState(0)
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [pendingBooking, setPendingBooking] = useState<{ date: string; startTime: Date; endTime: Date } | null>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  const hours = Array.from({ length: 16 }, (_, i) => i + 8) // 8 AM to midnight
  const HOUR_HEIGHT = 50

  // Validate slug and get owner info
  useEffect(() => {
    const validateSlug = async () => {
      try {
        const response = await fetch(`/api/booking-slug/lookup?slug=${slug}`)
        if (response.ok) {
          const data = await response.json()
          setOwnerName(data.name || 'Meeting')
          setOwnerEmail(data.email)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      }
    }
    validateSlug()
  }, [slug])

  // Fetch availability
  useEffect(() => {
    if (notFound || !ownerEmail) return

    const fetchWeekAvailability = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await Promise.all(
          weekDays.map(async (day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            try {
              const response = await fetch(`/api/availability?date=${dateStr}&slug=${slug}`)
              if (response.ok) {
                const data = await response.json()
                return { date: dateStr, slots: data.slots || [] }
              }
            } catch (e) {
              console.error('Failed to fetch', dateStr)
            }
            return { date: dateStr, slots: [] }
          })
        )
        setWeekSlots(results)
      } catch {
        setError('Unable to load availability')
      } finally {
        setLoading(false)
      }
    }

    fetchWeekAvailability()
  }, [currentWeek, ownerEmail, slug, notFound])

  const handleBack = () => {
    setShowForm(false)
    setSelectedSlot(null)
    setShowBookingModal(false)
    setPendingBooking(null)
  }

  // Handle drag start
  const handleDragStart = useCallback((dayIndex: number, e: React.MouseEvent) => {
    const day = weekDays[dayIndex]
    if (day < startOfDay(new Date())) return

    e.preventDefault()
    const column = columnRefs.current[dayIndex]
    if (!column) return

    const rect = column.getBoundingClientRect()
    const y = e.clientY - rect.top

    setIsDragging(true)
    setDragDayIndex(dayIndex)
    setDragStartY(y)
    setDragCurrentY(y)
  }, [weekDays])

  // Handle drag move
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || dragDayIndex === null) return

    const column = columnRefs.current[dragDayIndex]
    if (!column) return

    const rect = column.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, hours.length * HOUR_HEIGHT))
    setDragCurrentY(y)
  }, [isDragging, dragDayIndex, hours.length])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging || dragDayIndex === null) {
      setIsDragging(false)
      return
    }

    const column = columnRefs.current[dragDayIndex]
    if (!column) {
      setIsDragging(false)
      return
    }

    const minY = Math.min(dragStartY, dragCurrentY)
    const maxY = Math.max(dragStartY, dragCurrentY)

    const startMinutes = (minY / HOUR_HEIGHT) * 60
    const endMinutes = (maxY / HOUR_HEIGHT) * 60

    const startHour = Math.floor(startMinutes / 60) + 8
    const startMinute = Math.round((startMinutes % 60) / 15) * 15
    const endHour = Math.floor(endMinutes / 60) + 8
    const endMinute = Math.round((endMinutes % 60) / 15) * 15

    const day = weekDays[dragDayIndex]
    const dateStr = format(day, 'yyyy-MM-dd')

    const startTime = new Date(day)
    startTime.setHours(startHour, startMinute >= 60 ? 0 : startMinute, 0, 0)
    if (startMinute >= 60) startTime.setHours(startHour + 1)

    const endTime = new Date(day)
    const finalEndMinute = endMinute + 30
    endTime.setHours(endHour + Math.floor(finalEndMinute / 60), finalEndMinute % 60, 0, 0)

    if (endTime.getTime() - startTime.getTime() < 30 * 60 * 1000) {
      endTime.setTime(startTime.getTime() + 30 * 60 * 1000)
    }

    const dayStart = new Date(day)
    dayStart.setHours(8, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(24, 0, 0, 0)

    if (startTime < dayStart) startTime.setTime(dayStart.getTime())
    if (endTime > dayEnd) endTime.setTime(dayEnd.getTime())

    const daySlots = weekSlots.find(d => d.date === dateStr)
    const busyBlocks = mergeBusyBlocks(daySlots?.slots || [])
    const isAvailable = isTimeRangeAvailable(startTime, endTime, busyBlocks)

    if (isAvailable && endTime > startTime) {
      setPendingBooking({ date: dateStr, startTime, endTime })
      setShowBookingModal(true)
    }

    setIsDragging(false)
    setDragDayIndex(null)
  }, [isDragging, dragDayIndex, dragStartY, dragCurrentY, weekDays, weekSlots])

  const handleConfirmBooking = () => {
    if (!pendingBooking) return

    setSelectedSlot({
      date: pendingBooking.date,
      slot: {
        start: pendingBooking.startTime.toISOString(),
        end: pendingBooking.endTime.toISOString(),
        available: true
      }
    })
    setShowBookingModal(false)
    setShowForm(true)
  }

  const getDragSelectionStyle = useCallback((dayIndex: number) => {
    if (!isDragging || dragDayIndex !== dayIndex) return null

    const minY = Math.min(dragStartY, dragCurrentY)
    const maxY = Math.max(dragStartY, dragCurrentY)
    const height = Math.max(maxY - minY, 25)

    return { top: `${minY}px`, height: `${height}px` }
  }, [isDragging, dragDayIndex, dragStartY, dragCurrentY])

  const handleSubmit = async (data: { guestName: string; guestEmail: string; meetingTitle: string; message: string }) => {
    if (!selectedSlot) return

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          meetingTitle: data.meetingTitle,
          message: data.message,
          startTime: selectedSlot.slot.start,
          endTime: selectedSlot.slot.end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          slug
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create booking')
      }

      const result = await response.json()
      router.push(`/confirmation?id=${result.bookingId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking')
    }
  }

  const getSlotStyle = (slot: TimeSlot | MergedBlock) => {
    const start = parseISO(slot.start)
    const end = parseISO(slot.end)
    const dayStart = new Date(start)
    dayStart.setHours(8, 0, 0, 0)

    const startMinutes = differenceInMinutes(start, dayStart)
    const durationMinutes = differenceInMinutes(end, start)

    const top = Math.max(0, (startMinutes / 60) * 50)
    const height = (durationMinutes / 60) * 50

    return { top: `${top}px`, height: `${height}px` }
  }

  const isSlotVisible = (slot: TimeSlot | MergedBlock) => {
    const start = parseISO(slot.start)
    const hour = start.getHours()
    return hour >= 8 && hour < 24
  }

  // Not found state
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <DynamicBackground />
        <div className="relative z-10 text-center">
          <Logo size="lg" showText={false} href="/" />
          <h1 className="text-2xl font-bold text-white mt-6">Booking Link Not Found</h1>
          <p className="text-zinc-400 mt-2">This booking link doesn&apos;t exist or has been removed.</p>
        </div>
      </div>
    )
  }

  if (showForm && selectedSlot) {
    return (
      <div className="min-h-screen relative py-8 px-4">
        <DynamicBackground />
        <div className="max-w-md mx-auto">
          <BookingForm
            selectedDate={parseISO(selectedSlot.date)}
            selectedSlot={selectedSlot.slot}
            onSubmit={handleSubmit}
            onBack={handleBack}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-zinc-100 relative">
      <DynamicBackground />
      {/* Header */}
      <header className="bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile: stacked layout, Desktop: side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo showText={false} href="/" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">book with {ownerName}</h1>
                <p className="text-xs sm:text-sm text-zinc-400">tap or drag to select time</p>
              </div>
            </div>
            {/* Navigation controls */}
            <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2">
              <button
                onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Today
              </button>
              <div className="flex items-center">
                <button
                  onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                  className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs sm:text-sm font-medium text-zinc-300 min-w-[120px] sm:min-w-[180px] text-center">
                  {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d')}
                </span>
                <button
                  onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                  className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Legend - hidden on very small screens */}
      <div className="hidden sm:block bg-zinc-900/50 backdrop-blur-sm border-b border-zinc-800/50 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-dashed border-violet-400 rounded" />
            <span className="text-zinc-300">Drag to book</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-zinc-700 rounded" />
            <span className="text-zinc-500">Busy</span>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && pendingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBookingModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-2">Confirm Booking</h3>
            <p className="text-zinc-400 text-xs sm:text-sm mb-3 sm:mb-4">Tap times below to adjust:</p>
            <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 space-y-3 sm:space-y-4">
              <div className="text-white font-semibold text-sm sm:text-base">
                {format(pendingBooking.startTime, 'EEEE, MMMM d')}
              </div>

              {/* Editable time inputs */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs text-zinc-400 mb-1.5 font-medium">Start Time</label>
                  <input
                    type="time"
                    value={format(pendingBooking.startTime, 'HH:mm')}
                    onChange={(e) => {
                      if (!e.target.value) return
                      const [hours, minutes] = e.target.value.split(':').map(Number)
                      const newStart = new Date(pendingBooking.startTime)
                      newStart.setHours(hours, minutes, 0, 0)
                      // Ensure end time is still after start time
                      let newEnd = pendingBooking.endTime
                      if (newEnd <= newStart) {
                        newEnd = new Date(newStart.getTime() + 30 * 60 * 1000)
                      }
                      setPendingBooking({ ...pendingBooking, startTime: newStart, endTime: newEnd })
                    }}
                    className="w-full px-3 py-2.5 bg-zinc-700 border-2 border-violet-500/50 rounded-lg text-white text-base font-semibold text-center cursor-text hover:border-violet-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
                <span className="text-zinc-400 mt-6 text-sm font-medium">to</span>
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs text-zinc-400 mb-1.5 font-medium">End Time</label>
                  <input
                    type="time"
                    value={format(pendingBooking.endTime, 'HH:mm')}
                    onChange={(e) => {
                      if (!e.target.value) return
                      const [hours, minutes] = e.target.value.split(':').map(Number)
                      const newEnd = new Date(pendingBooking.endTime)
                      newEnd.setHours(hours, minutes, 0, 0)
                      // Ensure end time is after start time
                      if (newEnd > pendingBooking.startTime) {
                        setPendingBooking({ ...pendingBooking, endTime: newEnd })
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-zinc-700 border-2 border-violet-500/50 rounded-lg text-white text-base font-semibold text-center cursor-text hover:border-violet-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
              </div>

              <div className="text-zinc-400 text-xs sm:text-sm text-center">
                {Math.round((pendingBooking.endTime.getTime() - pendingBooking.startTime.getTime()) / 60000)} min meeting
              </div>

              {/* Check if selected time overlaps with busy blocks */}
              {(() => {
                const dateStr = pendingBooking.date
                const daySlots = weekSlots.find(d => d.date === dateStr)
                const busyBlocks = mergeBusyBlocks(daySlots?.slots || [])
                const isAvailable = isTimeRangeAvailable(pendingBooking.startTime, pendingBooking.endTime, busyBlocks)
                if (!isAvailable) {
                  return (
                    <div className="text-red-400 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      This time conflicts with a busy slot
                    </div>
                  )
                }
                return null
              })()}
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowBookingModal(false)}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={(() => {
                  const dateStr = pendingBooking.date
                  const daySlots = weekSlots.find(d => d.date === dateStr)
                  const busyBlocks = mergeBusyBlocks(daySlots?.slots || [])
                  return !isTimeRangeAvailable(pendingBooking.startTime, pendingBooking.endTime, busyBlocks)
                })()}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-fuchsia-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="max-w-7xl mx-auto px-1 sm:px-2 pb-4 sm:pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-10 w-10 border-4 border-zinc-700 border-t-violet-500 rounded-full" />
          </div>
        ) : (
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-800/50 mt-2 sm:mt-4 flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
            {/* Horizontally scrollable container for mobile */}
            <div className="overflow-x-auto flex-1 flex flex-col">
              <div className="min-w-[600px] sm:min-w-0 flex flex-col flex-1">
                {/* Day Headers */}
                <div className="grid grid-cols-8 border-b border-zinc-800 flex-shrink-0">
                  <div className="w-12 sm:w-16 border-r border-zinc-800" />
                  {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div
                        key={i}
                        className={`py-2 sm:py-3 text-center border-r border-zinc-800 ${isToday ? 'bg-violet-900/20' : ''}`}
                      >
                        <div className="text-[10px] sm:text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                          {format(day, 'EEE')}
                        </div>
                        <div className={`text-lg sm:text-2xl font-bold ${isToday ? 'text-violet-400' : 'text-zinc-400'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Time Grid */}
                <div
                  className="grid grid-cols-8 overflow-y-auto calendar-grid calendar-scroll select-none flex-1"
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onMouseMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                >
                  {/* Time Labels */}
                  <div className="border-r border-zinc-800 w-12 sm:w-16">
                    {hours.map(hour => (
                      <div key={hour} className="h-[40px] sm:h-[50px] border-b border-zinc-800/50 relative">
                        <span className="absolute -top-2 right-1 sm:right-2 text-[10px] sm:text-xs text-zinc-600 font-medium">
                          {format(new Date().setHours(hour, 0, 0, 0), 'ha')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {weekDays.map((day, dayIndex) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const dayData = weekSlots.find(d => d.date === dateStr)
                    const slots = dayData?.slots || []
                    const busyBlocks = mergeBusyBlocks(slots)
                    const isToday = isSameDay(day, new Date())
                    const isPast = day < startOfDay(new Date())
                    const dragStyle = getDragSelectionStyle(dayIndex)

                    // Touch handlers for mobile
                    const handleTouchStart = (e: React.TouchEvent) => {
                      if (isPast) return
                      const touch = e.touches[0]
                      const column = columnRefs.current[dayIndex]
                      if (!column) return
                      const rect = column.getBoundingClientRect()
                      const y = touch.clientY - rect.top
                      setIsDragging(true)
                      setDragDayIndex(dayIndex)
                      setDragStartY(y)
                      setDragCurrentY(y)
                    }

                    const handleTouchMove = (e: React.TouchEvent) => {
                      if (!isDragging || dragDayIndex !== dayIndex) return
                      const touch = e.touches[0]
                      const column = columnRefs.current[dayIndex]
                      if (!column) return
                      const rect = column.getBoundingClientRect()
                      const y = Math.max(0, Math.min(touch.clientY - rect.top, hours.length * HOUR_HEIGHT))
                      setDragCurrentY(y)
                    }

                    return (
                      <div
                        key={dayIndex}
                        ref={el => { columnRefs.current[dayIndex] = el }}
                        className={`border-r border-zinc-800 relative ${isToday ? 'bg-violet-900/10' : ''} ${isPast ? 'bg-zinc-900/50' : 'cursor-crosshair'}`}
                        onMouseDown={(e) => !isPast && handleDragStart(dayIndex, e)}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                      >
                        {hours.map(hour => (
                          <div key={hour} className="h-[40px] sm:h-[50px] border-b border-zinc-800/50" />
                        ))}

                        {dragStyle && (
                          <div
                            className="absolute left-0.5 right-0.5 bg-gradient-to-r from-violet-500/50 to-fuchsia-500/50 border-2 border-violet-400 rounded-lg pointer-events-none z-20 backdrop-blur-sm"
                            style={dragStyle}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs text-white font-semibold drop-shadow-lg">
                              {(() => {
                                const minY = Math.min(dragStartY, dragCurrentY)
                                const maxY = Math.max(dragStartY, dragCurrentY)
                                const hourHeight = window.innerWidth < 640 ? 40 : HOUR_HEIGHT
                                const startMins = (minY / hourHeight) * 60
                                const endMins = (maxY / hourHeight) * 60
                                const startH = Math.floor(startMins / 60) + 8
                                const startM = Math.round((startMins % 60) / 15) * 15
                                const endH = Math.floor(endMins / 60) + 8
                                const endM = Math.round((endMins % 60) / 15) * 15 + 30
                                return `${startH}:${String(startM % 60).padStart(2, '0')}-${endH}:${String(endM % 60).padStart(2, '0')}`
                              })()}
                            </div>
                          </div>
                        )}

                        {busyBlocks.filter(isSlotVisible).map((slot, i) => {
                          const style = getSlotStyle(slot)
                          const start = parseISO(slot.start)
                          const end = parseISO(slot.end)

                          return (
                            <div
                              key={i}
                              style={style}
                              className="absolute left-0.5 right-0.5 rounded px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs overflow-hidden bg-zinc-800/90 text-zinc-500 pointer-events-none border border-zinc-700/50"
                              title="Busy"
                            >
                              <div className="font-medium truncate">Busy</div>
                              <div className="hidden sm:block truncate opacity-70 text-[10px]">
                                {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                              </div>
                            </div>
                          )
                    })}
                  </div>
                )
              })}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
