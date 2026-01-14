import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bookingSchema } from '@/lib/utils/validation'

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

    const { guestName, guestEmail, message, startTime, endTime, timezone } = validation.data

    // Use the conflict-checking function
    const { data, error } = await supabaseAdmin.rpc('create_booking_if_available', {
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

    return NextResponse.json({
      success: true,
      bookingId: data,
      message: 'Booking confirmed!'
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
