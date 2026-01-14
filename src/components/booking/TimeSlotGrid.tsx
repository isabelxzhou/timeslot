'use client'

import { format } from 'date-fns'

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

interface TimeSlotGridProps {
  slots: TimeSlot[]
  selectedSlot: TimeSlot | null
  onSlotSelect: (slot: TimeSlot) => void
  loading?: boolean
}

export default function TimeSlotGrid({
  slots,
  selectedSlot,
  onSlotSelect,
  loading
}: TimeSlotGridProps) {
  const availableSlots = slots.filter(slot => slot.available)

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Loading available times...</p>
        </div>
      </div>
    )
  }

  if (availableSlots.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No available times</p>
          <p className="text-sm text-gray-400 mt-1">Try selecting a different date</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Select a Time
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableSlots.map((slot, i) => {
          const isSelected = selectedSlot?.start === slot.start
          const startTime = new Date(slot.start)

          return (
            <button
              key={i}
              onClick={() => onSlotSelect(slot)}
              className={`
                relative px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200
                ${isSelected
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                  : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:scale-102'
                }
              `}
            >
              {format(startTime, 'h:mm a')}
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-gray-400 text-center">
        {availableSlots.length} time{availableSlots.length !== 1 ? 's' : ''} available
      </p>
    </div>
  )
}
