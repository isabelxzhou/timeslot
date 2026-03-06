import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { bookingSchema } from '@/lib/utils/validation'
import { getPrimaryAccount, getValidAccessTokenForAccount, type GoogleAccount } from '@/lib/google/accounts'
import { createCalendarEvent } from '@/lib/google/calendar'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = bookingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { guestName, guestEmail, meetingTitle, message, startTime, endTime, timezone, slug } = validation.data

    // Use the conflict-checking function
    let bookingId: string
    try {
      const result = await sql`
        SELECT create_booking_if_available(
          ${guestName},
          ${guestEmail},
          ${message || null},
          ${startTime},
          ${endTime},
          ${timezone}
        ) as id
      `
      bookingId = result[0].id
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('Slot no longer available')) {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please select another time.' },
          { status: 409 }
        )
      }
      throw error
    }

    // Create Google Calendar event with invites
    let googleEventId: string | null = null
    let ownerAccount: GoogleAccount | null = null

    if (slug) {
      const rows = await sql`
        SELECT * FROM google_accounts WHERE booking_slug = ${slug} LIMIT 1
      `
      ownerAccount = (rows[0] as GoogleAccount) || null
    } else {
      ownerAccount = await getPrimaryAccount()
    }

    if (ownerAccount) {
      const accessToken = await getValidAccessTokenForAccount(ownerAccount)
      if (accessToken) {
        const eventTitle = meetingTitle || `Meeting with ${guestName}`
        googleEventId = await createCalendarEvent({
          accessToken,
          summary: eventTitle,
          description: message || `Booked via timeslot\n\nGuest: ${guestName}\nEmail: ${guestEmail}`,
          startTime,
          endTime,
          attendeeEmail: guestEmail,
          ownerEmail: ownerAccount.email,
          timezone
        })

        if (googleEventId) {
          await sql`
            UPDATE bookings SET google_event_id = ${googleEventId} WHERE id = ${bookingId}
          `
        }
      }
    }

    return NextResponse.json({
      success: true,
      bookingId,
      googleEventId,
      message: 'Booking confirmed! Calendar invites have been sent.'
    })
  } catch (error) {
    console.error('Booking error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())
    if (session.exp < Date.now()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const upcoming = searchParams.get('upcoming') === 'true'

  let bookings
  if (status && upcoming) {
    bookings = await sql`
      SELECT * FROM bookings
      WHERE status = ${status} AND start_time >= ${new Date().toISOString()}
      ORDER BY start_time ASC
    `
  } else if (status) {
    bookings = await sql`
      SELECT * FROM bookings WHERE status = ${status} ORDER BY start_time ASC
    `
  } else if (upcoming) {
    bookings = await sql`
      SELECT * FROM bookings WHERE start_time >= ${new Date().toISOString()} ORDER BY start_time ASC
    `
  } else {
    bookings = await sql`SELECT * FROM bookings ORDER BY start_time ASC`
  }

  return NextResponse.json({ bookings })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status, cancellationReason } = body

    if (!id) {
      return NextResponse.json({ error: 'Booking ID required' }, { status: 400 })
    }

    if (status === 'cancelled') {
      await sql`
        UPDATE bookings
        SET status = ${status},
            cancelled_at = ${new Date().toISOString()},
            cancellation_reason = ${cancellationReason || null}
        WHERE id = ${id}
      `
    } else if (status) {
      await sql`
        UPDATE bookings SET status = ${status} WHERE id = ${id}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update booking error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
