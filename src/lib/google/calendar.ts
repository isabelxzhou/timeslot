import { google } from 'googleapis'
import { getOAuthClient } from './oauth'

interface BusyTime {
  start: string
  end: string
}

export async function getFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<BusyTime[]> {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.map(id => ({ id }))
    }
  })

  const busyTimes: BusyTime[] = []
  const calendars = response.data.calendars || {}

  for (const calId of Object.keys(calendars)) {
    const calBusy = calendars[calId]?.busy || []
    for (const busy of calBusy) {
      if (busy.start && busy.end) {
        busyTimes.push({
          start: busy.start,
          end: busy.end
        })
      }
    }
  }

  return busyTimes
}

export async function getCalendarList(accessToken: string) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const response = await calendar.calendarList.list()

  return response.data.items || []
}

export interface CreateEventParams {
  accessToken: string
  summary: string
  description?: string
  startTime: string
  endTime: string
  attendeeEmail: string
  ownerEmail: string
  timezone: string
}

export async function createCalendarEvent(params: CreateEventParams): Promise<string | null> {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: params.accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all', // Send email invites to all attendees
      requestBody: {
        summary: params.summary,
        description: params.description || '',
        start: {
          dateTime: params.startTime,
          timeZone: params.timezone
        },
        end: {
          dateTime: params.endTime,
          timeZone: params.timezone
        },
        attendees: [
          { email: params.attendeeEmail },
          { email: params.ownerEmail, responseStatus: 'accepted' }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      }
    })

    return response.data.id || null
  } catch (error) {
    console.error('Failed to create calendar event:', error)
    return null
  }
}
