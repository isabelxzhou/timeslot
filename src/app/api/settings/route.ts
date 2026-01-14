import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) return null

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())
    if (session.exp < Date.now()) return null
    return session.email || null
  } catch {
    return null
  }
}

export async function GET() {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get settings for this user
  const { data, error } = await supabaseAdmin
    .from('owner_settings')
    .select('weekly_schedule, timezone, slot_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days')
    .eq('email', sessionEmail)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  // Return default settings if none exist
  const defaultSchedule = {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
    saturday: [],
    sunday: []
  }

  return NextResponse.json({
    weekly_schedule: data?.weekly_schedule || defaultSchedule,
    timezone: data?.timezone || 'America/New_York',
    slot_duration_minutes: data?.slot_duration_minutes || 30,
    buffer_minutes: data?.buffer_minutes || 0,
    min_notice_hours: data?.min_notice_hours || 24,
    booking_window_days: data?.booking_window_days || 30
  })
}

export async function PATCH(request: NextRequest) {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { weekly_schedule, timezone, slot_duration_minutes, buffer_minutes, min_notice_hours } = body

    // Check if settings exist for this user
    const { data: existing } = await supabaseAdmin
      .from('owner_settings')
      .select('id')
      .eq('email', sessionEmail)
      .single()

    const updateData: Record<string, unknown> = {}
    if (weekly_schedule !== undefined) updateData.weekly_schedule = weekly_schedule
    if (timezone !== undefined) updateData.timezone = timezone
    if (slot_duration_minutes !== undefined) updateData.slot_duration_minutes = slot_duration_minutes
    if (buffer_minutes !== undefined) updateData.buffer_minutes = buffer_minutes
    if (min_notice_hours !== undefined) updateData.min_notice_hours = min_notice_hours

    if (existing) {
      const { error } = await supabaseAdmin
        .from('owner_settings')
        .update(updateData)
        .eq('email', sessionEmail)

      if (error) {
        console.error('Error updating settings:', error)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
      }
    } else {
      // Create new settings record
      const { error } = await supabaseAdmin
        .from('owner_settings')
        .insert({
          email: sessionEmail,
          name: sessionEmail.split('@')[0],
          ...updateData
        })

      if (error) {
        console.error('Error creating settings:', error)
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
