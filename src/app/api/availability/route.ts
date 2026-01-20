import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { startOfDay, addDays } from 'date-fns'
import { getAllGoogleAccounts, getValidAccessTokenForAccount } from '@/lib/google/accounts'
import { getFreeBusy } from '@/lib/google/calendar'
import { generateSlots } from '@/lib/utils/slots'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Prevent caching
export const dynamic = 'force-dynamic'

// Helper to get email from session cookie
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  const slug = searchParams.get('slug')

  if (!dateParam) {
    return NextResponse.json({ error: 'Date parameter required' }, { status: 400 })
  }

  try {
    // Parse the date for database queries (UTC)
    const date = startOfDay(new Date(dateParam + 'T00:00:00'))
    const nextDay = addDays(date, 1)

    // Get Google accounts - either for specific slug owner or logged-in user's accounts
    let accounts: Awaited<ReturnType<typeof getAllGoogleAccounts>> = []
    let ownerEmail: string | null = null

    console.log('=== Availability API ===')
    console.log('Date:', dateParam, 'Slug:', slug)

    try {
      if (slug) {
        // Look up the owner by booking slug
        const { data: slugOwner } = await supabaseAdmin
          .from('google_accounts')
          .select('owner_email')
          .eq('booking_slug', slug)
          .single()

        console.log('Slug owner lookup result:', slugOwner)

        if (slugOwner?.owner_email) {
          ownerEmail = slugOwner.owner_email
          // Get ALL accounts owned by this user
          accounts = await getAllGoogleAccounts(ownerEmail || undefined)
          console.log('Found', accounts.length, 'accounts for owner', ownerEmail)
        } else {
          console.log('No owner found for slug:', slug)
        }
      } else {
        // Get logged-in user's accounts
        const sessionEmail = await getSessionEmail()
        console.log('Session email:', sessionEmail)
        if (sessionEmail) {
          ownerEmail = sessionEmail
          accounts = await getAllGoogleAccounts(sessionEmail)
          console.log('Found', accounts.length, 'accounts for session')
        }
      }
    } catch (error) {
      console.log('Could not fetch google_accounts:', error)
    }

    // Get owner settings for schedule configuration - filter by owner email
    let settings
    if (ownerEmail) {
      const { data } = await supabaseAdmin
        .from('owner_settings')
        .select('*')
        .eq('email', ownerEmail)
        .single()
      settings = data
    }

    // Fall back to default settings if none found
    if (!settings) {
      settings = {
        weekly_schedule: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '17:00' }],
          saturday: [],
          sunday: []
        },
        timezone: 'America/New_York',
        slot_duration_minutes: 30,
        buffer_minutes: 0,
        min_notice_hours: 24,
        booking_window_days: 30
      }
      console.log('Using default settings for owner:', ownerEmail)
    } else {
      console.log('Found settings for owner:', ownerEmail)
    }

    // Get existing bookings for the date
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .gte('start_time', date.toISOString())
      .lt('start_time', nextDay.toISOString())
      .eq('status', 'confirmed')

    // Aggregate busy times from accounts
    let allBusyTimes: { start: string; end: string }[] = []

    for (const account of accounts) {
      console.log('Processing account:', account.email)
      const accessToken = await getValidAccessTokenForAccount(account)
      if (accessToken) {
        // Default to ['primary'] if calendar_ids is null, undefined, or empty array
        const rawCalendarIds = account.calendar_ids as string[] | null | undefined
        const calendarIds = rawCalendarIds && rawCalendarIds.length > 0 ? rawCalendarIds : ['primary']
        console.log('Fetching busy times from calendars:', calendarIds)
        try {
          const busyTimes = await getFreeBusy(accessToken, calendarIds, date, nextDay)
          console.log('Got', busyTimes.length, 'busy times from', account.email)
          allBusyTimes = allBusyTimes.concat(busyTimes)
        } catch (error) {
          console.error(`Failed to fetch calendar for ${account.email}:`, error)
        }
      } else {
        console.log('No valid access token for', account.email)
      }
    }
    console.log('Total busy times:', allBusyTimes.length)

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
        available: slot.available,
        busy: slot.busy
      }))
    })
  } catch (error) {
    console.error('Availability error:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}
