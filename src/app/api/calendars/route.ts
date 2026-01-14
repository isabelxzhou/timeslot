import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAllGoogleAccounts, getValidAccessTokenForAccount } from '@/lib/google/accounts'
import { getCalendarList } from '@/lib/google/calendar'
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

// GET - List all calendars for all connected accounts
export async function GET() {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await getAllGoogleAccounts(sessionEmail)
    const result: {
      accountEmail: string
      calendars: { id: string; summary: string; primary: boolean; selected: boolean }[]
    }[] = []

    for (const account of accounts) {
      const accessToken = await getValidAccessTokenForAccount(account)
      if (!accessToken) continue

      try {
        const calendars = await getCalendarList(accessToken)
        const selectedIds = (account.calendar_ids as string[]) || ['primary']

        result.push({
          accountEmail: account.email,
          calendars: calendars.map(cal => ({
            id: cal.id || 'primary',
            summary: cal.summary || cal.id || 'Unknown',
            primary: cal.primary || false,
            selected: selectedIds.includes(cal.id || 'primary')
          }))
        })
      } catch (error) {
        console.error(`Failed to fetch calendars for ${account.email}:`, error)
      }
    }

    return NextResponse.json({ accounts: result })
  } catch (error) {
    console.error('Error fetching calendars:', error)
    return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 })
  }
}

// PATCH - Update selected calendars for an account
export async function PATCH(request: NextRequest) {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { accountEmail, calendarIds } = await request.json()

    if (!accountEmail || !Array.isArray(calendarIds)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Verify the account belongs to this user
    const { data: account } = await supabaseAdmin
      .from('google_accounts')
      .select('id, owner_email')
      .eq('email', accountEmail)
      .single()

    if (!account || account.owner_email !== sessionEmail) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update calendar_ids
    const { error } = await supabaseAdmin
      .from('google_accounts')
      .update({ calendar_ids: calendarIds })
      .eq('email', accountEmail)

    if (error) {
      console.error('Error updating calendars:', error)
      return NextResponse.json({ error: 'Failed to update calendars' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating calendars:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
