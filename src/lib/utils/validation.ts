import { z } from 'zod'

export const bookingSchema = z.object({
  guestName: z.string().min(1, 'Name is required').max(255),
  guestEmail: z.string().email('Invalid email address'),
  message: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string()
})

export type BookingInput = z.infer<typeof bookingSchema>

export const settingsSchema = z.object({
  timezone: z.string(),
  slotDurationMinutes: z.number().min(15).max(120),
  bufferMinutes: z.number().min(0).max(60),
  bookingWindowDays: z.number().min(1).max(90),
  minNoticeHours: z.number().min(0).max(168),
  weeklySchedule: z.record(z.string(), z.array(z.object({
    start: z.string(),
    end: z.string()
  })))
})

export type SettingsInput = z.infer<typeof settingsSchema>
