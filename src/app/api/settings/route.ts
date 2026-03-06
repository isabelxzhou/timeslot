import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

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

  const rows = await sql`
    SELECT weekly_schedule, timezone, slot_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days
    FROM owner_settings
    WHERE email = ${sessionEmail}
    LIMIT 1
  `
  const data = rows[0]

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
    const existing = await sql`
      SELECT id FROM owner_settings WHERE email = ${sessionEmail} LIMIT 1
    `

    if (existing.length > 0) {
      // Build dynamic update - always update all provided fields
      await sql`
        UPDATE owner_settings
        SET weekly_schedule = COALESCE(${weekly_schedule ? JSON.stringify(weekly_schedule) : null}::jsonb, weekly_schedule),
            timezone = COALESCE(${timezone ?? null}, timezone),
            slot_duration_minutes = COALESCE(${slot_duration_minutes ?? null}, slot_duration_minutes),
            buffer_minutes = COALESCE(${buffer_minutes ?? null}, buffer_minutes),
            min_notice_hours = COALESCE(${min_notice_hours ?? null}, min_notice_hours)
        WHERE email = ${sessionEmail}
      `
    } else {
      await sql`
        INSERT INTO owner_settings (email, name, weekly_schedule, timezone, slot_duration_minutes, buffer_minutes, min_notice_hours)
        VALUES (
          ${sessionEmail},
          ${sessionEmail.split('@')[0]},
          ${weekly_schedule ? JSON.stringify(weekly_schedule) : '{"monday":[{"start":"09:00","end":"17:00"}],"tuesday":[{"start":"09:00","end":"17:00"}],"wednesday":[{"start":"09:00","end":"17:00"}],"thursday":[{"start":"09:00","end":"17:00"}],"friday":[{"start":"09:00","end":"17:00"}],"saturday":[],"sunday":[]}'}::jsonb,
          ${timezone || 'America/New_York'},
          ${slot_duration_minutes || 30},
          ${buffer_minutes || 0},
          ${min_notice_hours || 24}
        )
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
