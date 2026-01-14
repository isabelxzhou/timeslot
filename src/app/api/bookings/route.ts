import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bookingSchema } from '@/lib/utils/validation'
import { getPrimaryAccount, getValidAccessTokenForAccount } from '@/lib/google/accounts'
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
    const { data: bookingId, error } = await supabaseAdmin.rpc('create_booking_if_available', {
      p_guest_name: guestName,
      p_guest_email: guestEmail,
      p_message: message || null,
      p_start_time: startTime,
      p_end_time: endTime,
      p_timezone: timezone
    })

    if (error) {
      if (error.message.includes('Slot no longer available')) {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please select another time.' },
          { status: 409 }
        )
      }
      throw error
    }

    // Create Google Calendar event with invites
    let googleEventId: string | null = null
    let ownerAccount = null

    // If slug is provided, look up the account by slug, otherwise use primary account
    if (slug) {
      const { data: slugAccount } = await supabaseAdmin
        .from('google_accounts')
        .select('*')
        .eq('booking_slug', slug)
        .single()
      ownerAccount = slugAccount
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

        // Update booking with Google event ID
        if (googleEventId) {
          await supabaseAdmin
            .from('bookings')
            .update({ google_event_id: googleEventId })
            .eq('id', bookingId)
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

  let query = supabaseAdmin
    .from('bookings')
    .select('*')
    .order('start_time', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  if (upcoming) {
    query = query.gte('start_time', new Date().toISOString())
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  return NextResponse.json({ bookings: data })
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

    const updateData: Record<string, unknown> = {}

    if (status) {
      updateData.status = status
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString()
        if (cancellationReason) {
          updateData.cancellation_reason = cancellationReason
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update booking error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
