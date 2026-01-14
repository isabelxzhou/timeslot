import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAllGoogleAccounts, getValidAccessTokenForAccount } from '@/lib/google/accounts'
import { google } from 'googleapis'
import { getOAuthClient } from '@/lib/google/oauth'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  calendarEmail: string
  color: string
}

// Modern dark muted colors - low saturation, elegant
const CALENDAR_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#F43F5E', // rose
  '#64748B', // slate
]

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start and end dates required' }, { status: 400 })
  }

  try {
    const accounts = await getAllGoogleAccounts()
    const allEvents: CalendarEvent[] = []

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]
      const accessToken = await getValidAccessTokenForAccount(account)

      if (!accessToken) continue

      const oauth2Client = getOAuthClient()
      oauth2Client.setCredentials({ access_token: accessToken })

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
      const calendarIds = (account.calendar_ids as string[]) || ['primary']
      const color = CALENDAR_COLORS[i % CALENDAR_COLORS.length]

      for (const calendarId of calendarIds) {
        try {
          const response = await calendar.events.list({
            calendarId,
            timeMin: new Date(startDate).toISOString(),
            timeMax: new Date(endDate).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
          })

          const events = response.data.items || []

          for (const event of events) {
            if (!event.start) continue

            // Use summary or default to "(No title)"
            const title = event.summary || '(No title)'

            const isAllDay = !event.start.dateTime
            const eventStart = event.start.dateTime || event.start.date
            const eventEnd = event.end?.dateTime || event.end?.date

            if (!eventStart || !eventEnd) continue

            allEvents.push({
              id: event.id || `${account.email}-${Date.now()}-${Math.random()}`,
              title,
              start: eventStart,
              end: eventEnd,
              allDay: isAllDay,
              calendarEmail: account.email,
              color,
            })
          }
        } catch (error: any) {
          console.error(`Failed to fetch events from ${calendarId} for ${account.email}:`, error)
          // Check if it's an API not enabled error
          if (error?.code === 403 && error?.message?.includes('Calendar API')) {
            return NextResponse.json({
              events: [],
              accounts: [],
              error: 'Google Calendar API is not enabled. Please enable it in Google Cloud Console.',
              apiNotEnabled: true,
            })
          }
        }
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({
      events: allEvents,
      accounts: accounts.map((a, i) => ({
        email: a.email,
        color: CALENDAR_COLORS[i % CALENDAR_COLORS.length],
      })),
    })
  } catch (error) {
    console.error('Calendar events error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}
