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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
          <div key={dayName} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
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
              disabled={!isAvailable || !isCurrentMonth}
              className={`
                relative aspect-square flex items-center justify-center text-sm font-medium rounded-xl transition-all duration-200
                ${!isCurrentMonth ? 'text-gray-200 cursor-default' : ''}
                ${isAvailable && isCurrentMonth && !isSelected
                  ? 'text-gray-900 hover:bg-blue-50 hover:text-blue-600 cursor-pointer hover:scale-105'
                  : ''
                }
                ${isSelected
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                  : ''
                }
                ${!isAvailable && isCurrentMonth && !isSelected
                  ? 'text-gray-300 cursor-not-allowed'
                  : ''
                }
                ${isToday && !isSelected && isCurrentMonth
                  ? 'ring-2 ring-blue-200 ring-offset-2'
                  : ''
                }
              `}
            >
              {format(dayDate, 'd')}
              {isAvailable && isCurrentMonth && !isSelected && (
                <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-green-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded ring-2 ring-blue-200"></span>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
