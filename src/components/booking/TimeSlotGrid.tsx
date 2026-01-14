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
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  if (availableSlots.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <p className="text-center text-gray-500 py-4">
          No available time slots for this date.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Available Times</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableSlots.map((slot, i) => {
          const isSelected = selectedSlot?.start === slot.start
          const startTime = new Date(slot.start)

          return (
            <button
              key={i}
              onClick={() => onSlotSelect(slot)}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-blue-700'
                }
              `}
            >
              {format(startTime, 'h:mm a')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
