'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

interface BookingFormProps {
  selectedDate: Date
  selectedSlot: TimeSlot
  onSubmit: (data: { guestName: string; guestEmail: string; meetingTitle: string; message: string }) => Promise<void>
  onBack: () => void
}

export default function BookingForm({
  selectedDate,
  selectedSlot,
  onSubmit,
  onBack
}: BookingFormProps) {
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!guestName.trim()) {
      newErrors.guestName = 'Name is required'
    }

    if (!guestEmail.trim()) {
      newErrors.guestEmail = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      newErrors.guestEmail = 'Invalid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit({ guestName, guestEmail, meetingTitle, message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-800 p-6">
      <div className="mb-6 pb-4 border-b border-zinc-800">
        <button
          onClick={onBack}
          className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h3 className="text-lg font-semibold text-white">Confirm Your Booking</h3>
        <p className="text-zinc-400 mt-1">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')} at{' '}
          <span className="text-violet-400 font-medium">{format(new Date(selectedSlot.start), 'h:mm a')}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Meeting Title (optional)"
          value={meetingTitle}
          onChange={e => setMeetingTitle(e.target.value)}
          placeholder="Quick sync, Project discussion, etc."
        />

        <Input
          label="Your Name"
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          error={errors.guestName}
          placeholder="John Doe"
          required
        />

        <Input
          label="Email Address"
          type="email"
          value={guestEmail}
          onChange={e => setGuestEmail(e.target.value)}
          error={errors.guestEmail}
          placeholder="john@example.com"
          required
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-300">
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            rows={3}
            placeholder="What would you like to discuss?"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Confirm Booking
        </Button>
      </form>
    </div>
  )
}
