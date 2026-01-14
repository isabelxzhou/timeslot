'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns'

interface CalendarViewProps {
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  availableDays?: number[]
  minDate?: Date
  maxDate?: Date
}

export default function CalendarView({
  selectedDate,
  onDateSelect,
  availableDays = [1, 2, 3, 4, 5],
  minDate = new Date(),
  maxDate
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = []
  let day = calendarStart

  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const isDateAvailable = (date: Date): boolean => {
    const dayOfWeek = date.getDay()
    const today = startOfDay(new Date())

    if (isBefore(date, today)) return false
    if (minDate && isBefore(date, startOfDay(minDate))) return false
    if (maxDate && isAfter(date, maxDate)) return false
    if (!availableDays.includes(dayOfWeek)) return false

    return true
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
          <div key={dayName} className="text-center text-xs font-medium text-gray-500 py-2">
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((dayDate, i) => {
          const isCurrentMonth = isSameMonth(dayDate, currentMonth)
          const isSelected = selectedDate && isSameDay(dayDate, selectedDate)
          const isAvailable = isDateAvailable(dayDate)
          const isToday = isSameDay(dayDate, new Date())

          return (
            <button
              key={i}
              onClick={() => isAvailable && onDateSelect(dayDate)}
              disabled={!isAvailable}
              className={`
                p-2 text-sm rounded-lg transition-colors relative
                ${!isCurrentMonth ? 'text-gray-300' : ''}
                ${isAvailable && isCurrentMonth ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-not-allowed'}
                ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                ${!isSelected && isAvailable && isCurrentMonth ? 'text-gray-900' : ''}
                ${!isAvailable && isCurrentMonth ? 'text-gray-300' : ''}
              `}
            >
              {format(dayDate, 'd')}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
