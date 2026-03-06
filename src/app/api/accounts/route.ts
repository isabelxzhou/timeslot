import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

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

  const allAccounts = await sql`
    SELECT * FROM google_accounts ORDER BY is_primary DESC
  `

  console.log('=== Accounts API Debug ===')
  console.log('Session email:', sessionEmail)
  console.log('Total accounts in DB:', allAccounts.length)
  allAccounts.forEach(a => {
    console.log(`  - ${a.email}: owner_email="${a.owner_email}"`)
  })

  const accounts = allAccounts.filter(account => {
    return account.owner_email === sessionEmail
  })

  const needsOwnerMigration = allAccounts.some(a => a.owner_email === undefined)

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

  const rows = await sql`
    SELECT * FROM google_accounts WHERE email = ${email} LIMIT 1
  `
  const account = rows[0]

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const isOwner = account.owner_email === sessionEmail ||
    (!account.owner_email && account.email === sessionEmail)

  if (!isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await sql`DELETE FROM google_accounts WHERE email = ${email}`

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
      const allAccounts = await sql`SELECT * FROM google_accounts`

      if (!allAccounts) {
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
      }

      const userAccounts = allAccounts.filter(a =>
        a.owner_email === sessionEmail ||
        (!a.owner_email && a.email === sessionEmail)
      )

      const targetAccount = userAccounts.find(a => a.id === id)
      if (!targetAccount) {
        return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 })
      }

      // Set all user's other accounts to non-primary
      for (const account of userAccounts) {
        if (account.id !== id && account.is_primary) {
          await sql`UPDATE google_accounts SET is_primary = false WHERE id = ${account.id}`
        }
      }

      // Set the selected account as primary
      await sql`UPDATE google_accounts SET is_primary = true WHERE id = ${id}`

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Failed to update account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}
