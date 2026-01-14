'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays } from 'date-fns'
import CalendarView from '@/components/booking/CalendarView'
import TimeSlotGrid from '@/components/booking/TimeSlotGrid'
import BookingForm from '@/components/booking/BookingForm'

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

type Step = 'date' | 'time' | 'form'

export default function BookPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('date')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = async (date: Date) => {
    setLoading(true)
    setError(null)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/availability?date=${dateStr}`)

      if (!response.ok) {
        throw new Error('Failed to fetch availability')
      }

      const data = await response.json()
      setSlots(data.slots || [])
    } catch (err) {
      setError('Unable to load available times. Please try again.')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate)
    }
  }, [selectedDate])

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setStep('time')
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setStep('form')
  }

  const handleBack = () => {
    if (step === 'form') {
      setStep('time')
      setSelectedSlot(null)
    } else if (step === 'time') {
      setStep('date')
      setSelectedDate(null)
      setSlots([])
    }
  }

  const handleSubmit = async (data: { guestName: string; guestEmail: string; message: string }) => {
    if (!selectedSlot || !selectedDate) return

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          message: data.message,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </a>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Book a Time</h1>
          <p className="text-gray-600 mt-1">
            {step === 'date' && 'Select a date to see available times'}
            {step === 'time' && selectedDate && `Available times for ${format(selectedDate, 'MMMM d, yyyy')}`}
            {step === 'form' && 'Enter your details to confirm'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'date' && (
          <CalendarView
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            minDate={new Date()}
            maxDate={addDays(new Date(), 30)}
          />
        )}

        {step === 'time' && selectedDate && (
          <div className="space-y-4">
            <button
              onClick={handleBack}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change date
            </button>
            <TimeSlotGrid
              slots={slots}
              selectedSlot={selectedSlot}
              onSlotSelect={handleSlotSelect}
              loading={loading}
            />
          </div>
        )}

        {step === 'form' && selectedDate && selectedSlot && (
          <BookingForm
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onSubmit={handleSubmit}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
