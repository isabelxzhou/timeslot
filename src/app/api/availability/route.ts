import { NextRequest, NextResponse } from 'next/server'
import { startOfDay, addDays } from 'date-fns'
import { getAllGoogleAccounts, getValidAccessTokenForAccount } from '@/lib/google/accounts'
import { getFreeBusy } from '@/lib/google/calendar'
import { generateSlots } from '@/lib/utils/slots'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  if (!dateParam) {
    return NextResponse.json({ error: 'Date parameter required' }, { status: 400 })
  }

  try {
    // Get owner settings for schedule configuration
    const { data: settings } = await supabaseAdmin
      .from('owner_settings')
      .select('*')
      .limit(1)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Owner not configured' }, { status: 503 })
    }

    // Parse the date for database queries (UTC)
    const date = startOfDay(new Date(dateParam + 'T00:00:00'))
    const nextDay = addDays(date, 1)

    // Get existing bookings for the date
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .gte('start_time', date.toISOString())
      .lt('start_time', nextDay.toISOString())
      .eq('status', 'confirmed')

    // Get ALL connected Google accounts
    const accounts = await getAllGoogleAccounts()

    // Aggregate busy times from ALL accounts
    let allBusyTimes: { start: string; end: string }[] = []

    for (const account of accounts) {
      const accessToken = await getValidAccessTokenForAccount(account)
      if (accessToken) {
        const calendarIds = (account.calendar_ids as string[]) || ['primary']
        try {
          const busyTimes = await getFreeBusy(accessToken, calendarIds, date, nextDay)
          allBusyTimes = allBusyTimes.concat(busyTimes)
        } catch (error) {
          console.error(`Failed to fetch calendar for ${account.email}:`, error)
        }
      }
    }

    // Pass the date string (YYYY-MM-DD) to generateSlots for proper timezone handling
    const slots = generateSlots(dateParam, settings, allBusyTimes, bookings || [])

    return NextResponse.json({
      date: dateParam,
      timezone: settings.timezone,
      slotDuration: settings.slot_duration_minutes,
      connectedAccounts: accounts.map(a => a.email),
      slots: slots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: slot.available
      }))
    })
  } catch (error) {
    console.error('Availability error:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}
