import { addMinutes, startOfDay, format, isBefore, isAfter, addHours } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import type { Booking, OwnerSettings } from '@/types/database'

export interface TimeSlot {
  start: Date
  end: Date
  available: boolean
  busy: boolean // true if blocked by Google Calendar event
}

interface BusyTime {
  start: string
  end: string
}

interface ScheduleBlock {
  start: string
  end: string
}

type WeeklySchedule = {
  [key: string]: ScheduleBlock[]
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function parseTime(dateStr: string, timeStr: string, timezone: string): Date {
  // Parse the time string (e.g., "9:00" or "09:00")
  const [hours, minutes] = timeStr.split(':').map(Number)

  // Create a date in the specified timezone
  // dateStr is like "2026-01-15", we want to create "9:00 AM in America/New_York"
  const [year, month, day] = dateStr.split('-').map(Number)

  // Create a date object for this specific date/time
  // We'll use fromZonedTime to convert from the owner's timezone to UTC
  const dateTimeStr = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

  // fromZonedTime: given a time that's in a specific timezone, convert to UTC
  return fromZonedTime(dateTimeStr, timezone)
}

function isOverlapping(
  slotStart: Date,
  slotEnd: Date,
  ranges: { start: Date | string; end: Date | string }[]
): boolean {
  for (const range of ranges) {
    const rangeStart = typeof range.start === 'string' ? new Date(range.start) : range.start
    const rangeEnd = typeof range.end === 'string' ? new Date(range.end) : range.end

    if (slotStart < rangeEnd && slotEnd > rangeStart) {
      return true
    }
  }
  return false
}

export function generateSlots(
  dateStr: string,
  settings: OwnerSettings,
  busyTimes: BusyTime[],
  existingBookings: Booking[]
): TimeSlot[] {
  const timezone = settings.timezone || 'America/New_York'

  const slots: TimeSlot[] = []
  const slotDuration = settings.slot_duration_minutes || 30
  const buffer = settings.buffer_minutes || 0

  const now = new Date()

  const confirmedBookings = existingBookings.filter(b => b.status === 'confirmed')

  // Generate slots for entire day (6 AM to 11 PM) - no schedule restrictions
  // All times are available except for busy times from Google Calendar
  const dayStart = '06:00'
  const dayEnd = '23:00'

  let current = parseTime(dateStr, dayStart, timezone)
  const blockEnd = parseTime(dateStr, dayEnd, timezone)

  while (addMinutes(current, slotDuration) <= blockEnd) {
    const slotEnd = addMinutes(current, slotDuration)

    const isInPast = isBefore(current, now)
    const busyConflict = isOverlapping(current, slotEnd, busyTimes.map(b => ({
      start: new Date(b.start),
      end: new Date(b.end)
    })))
    const bookingConflict = isOverlapping(current, slotEnd, confirmedBookings.map(b => ({
      start: new Date(b.start_time),
      end: new Date(b.end_time)
    })))

    // Track if slot is busy from calendar (separate from just being in the past)
    const isBusy = busyConflict || bookingConflict
    const isAvailable = !isInPast && !isBusy

    slots.push({
      start: current,
      end: slotEnd,
      available: isAvailable,
      busy: isBusy
    })

    current = addMinutes(slotEnd, buffer)
  }

  return slots
}

export function formatSlotTime(date: Date, timezone: string): string {
  const zonedDate = toZonedTime(date, timezone)
  return format(zonedDate, 'h:mm a')
}

export function getAvailableDates(
  settings: OwnerSettings,
  startDate: Date,
  days: number
): Date[] {
  const dates: Date[] = []

  // All dates are available - no schedule restrictions
  for (let i = 0; i < days; i++) {
    const date = addHours(startOfDay(startDate), 24 * i)
    dates.push(date)
  }

  return dates
}
