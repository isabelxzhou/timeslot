import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Prevent caching
export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'No session cookie', session: null })
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())

    // Get accounts for this session email
    const { data: allAccounts } = await supabaseAdmin
      .from('google_accounts')
      .select('email, owner_email, is_primary')

    const filteredAccounts = (allAccounts || []).filter(a => a.owner_email === session.email)

    return NextResponse.json({
      sessionEmail: session.email,
      sessionExp: new Date(session.exp).toISOString(),
      isExpired: session.exp < Date.now(),
      allAccountsInDB: allAccounts,
      filteredForSession: filteredAccounts
    })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid session', details: String(e) })
  }
}
