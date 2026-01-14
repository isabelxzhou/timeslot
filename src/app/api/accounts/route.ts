import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // First check if table exists by trying a simple query
  const { data: accounts, error } = await supabaseAdmin
    .from('google_accounts')
    .select('id, email, name, is_primary, created_at')
    .order('is_primary', { ascending: false })

  if (error) {
    console.error('Error fetching accounts:', error.message, error.code, error.details)
    // If table doesn't exist, return empty with a hint
    if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('schema cache')) {
      return NextResponse.json({
        accounts: [],
        needsMigration: true,
        warning: 'The google_accounts table needs to be created. Please run the SQL in supabase/migrations/002_multi_account.sql in your Supabase SQL Editor.'
      })
    }
    return NextResponse.json({ accounts: [], error: error.message })
  }

  console.log('Fetched accounts:', accounts?.length || 0, 'accounts')

  return NextResponse.json({ accounts: accounts || [] })
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  await supabaseAdmin
    .from('google_accounts')
    .delete()
    .eq('email', email)

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, setPrimary } = body

    if (setPrimary && id) {
      // First, set all accounts to non-primary
      await supabaseAdmin
        .from('google_accounts')
        .update({ is_primary: false })
        .neq('id', id)

      // Then set the selected account as primary
      await supabaseAdmin
        .from('google_accounts')
        .update({ is_primary: true })
        .eq('id', id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Failed to update account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}
