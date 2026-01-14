import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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

export async function GET() {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all accounts and filter in code (more resilient to missing columns)
  const { data: allAccounts, error } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .order('is_primary', { ascending: false })

  if (error) {
    console.error('Error fetching accounts:', error.message)
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ accounts: [], needsMigration: true })
    }
    return NextResponse.json({ accounts: [], error: error.message })
  }

  // Log what we're working with
  console.log('=== Accounts API Debug ===')
  console.log('Session email:', sessionEmail)
  console.log('Total accounts in DB:', allAccounts?.length || 0)
  allAccounts?.forEach(a => {
    console.log(`  - ${a.email}: owner_email="${a.owner_email}"`)
  })

  // Filter accounts - ONLY show accounts where owner_email matches exactly
  const accounts = (allAccounts || []).filter(account => {
    return account.owner_email === sessionEmail
  })

  // Check if we need to show migration warning (owner_email column missing)
  const needsOwnerMigration = allAccounts?.some(a => a.owner_email === undefined)

  console.log('Filtered accounts:', accounts.length)
  accounts.forEach(a => console.log(`  - ${a.email}`))
  console.log('===========================')

  return NextResponse.json({
    accounts: accounts.map(a => ({
      id: a.id,
      email: a.email,
      name: a.name,
      is_primary: a.is_primary,
      created_at: a.created_at
    })),
    needsOwnerMigration
  })
}

export async function DELETE(request: NextRequest) {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  // First, verify this account belongs to the user (fetch and check in code for resilience)
  const { data: account } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .eq('email', email)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Check ownership: owner_email matches OR (owner_email is null AND email matches session)
  const isOwner = account.owner_email === sessionEmail ||
    (!account.owner_email && account.email === sessionEmail)

  if (!isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await supabaseAdmin
    .from('google_accounts')
    .delete()
    .eq('email', email)

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const sessionEmail = await getSessionEmail()

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, setPrimary } = body

    if (setPrimary && id) {
      // Fetch all accounts to filter in code (resilient to missing owner_email column)
      const { data: allAccounts } = await supabaseAdmin
        .from('google_accounts')
        .select('*')

      if (!allAccounts) {
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
      }

      // Filter to get user's accounts
      const userAccounts = allAccounts.filter(a =>
        a.owner_email === sessionEmail ||
        (!a.owner_email && a.email === sessionEmail)
      )

      // Verify the target account belongs to this user
      const targetAccount = userAccounts.find(a => a.id === id)
      if (!targetAccount) {
        return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 })
      }

      // Set all user's other accounts to non-primary
      for (const account of userAccounts) {
        if (account.id !== id && account.is_primary) {
          await supabaseAdmin
            .from('google_accounts')
            .update({ is_primary: false })
            .eq('id', account.id)
        }
      }

      // Set the selected account as primary
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
