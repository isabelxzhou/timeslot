import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

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

// GET - Get current booking slug
export async function GET() {
  try {
    const sessionEmail = await getSessionEmail()

    if (!sessionEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rows = await sql`
      SELECT booking_slug FROM google_accounts WHERE email = ${sessionEmail} LIMIT 1
    `
    const account = rows[0]

    let slug = account?.booking_slug
    if (!slug) {
      slug = generateSlug()
      await sql`
        UPDATE google_accounts SET booking_slug = ${slug} WHERE email = ${sessionEmail}
      `
    }

    return NextResponse.json({ slug, email: sessionEmail })
  } catch (error) {
    console.error('Error in GET /api/booking-slug:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Check if slug is available
export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json()

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        available: false,
        error: 'Slug can only contain lowercase letters, numbers, and hyphens'
      }, { status: 400 })
    }

    if (slug.length < 3 || slug.length > 30) {
      return NextResponse.json({
        available: false,
        error: 'Slug must be between 3 and 30 characters'
      }, { status: 400 })
    }

    const sessionEmail = await getSessionEmail()

    if (!sessionEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rows = await sql`
      SELECT email FROM google_accounts WHERE booking_slug = ${slug} LIMIT 1
    `
    const existingAccount = rows[0]

    const isAvailable = !existingAccount || existingAccount.email === sessionEmail

    return NextResponse.json({ available: isAvailable })
  } catch (error) {
    console.error('Error in POST /api/booking-slug:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update booking slug
export async function PATCH(request: NextRequest) {
  try {
    const { slug } = await request.json()

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        error: 'Slug can only contain lowercase letters, numbers, and hyphens'
      }, { status: 400 })
    }

    if (slug.length < 3 || slug.length > 30) {
      return NextResponse.json({
        error: 'Slug must be between 3 and 30 characters'
      }, { status: 400 })
    }

    const sessionEmail = await getSessionEmail()

    if (!sessionEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rows = await sql`
      SELECT email FROM google_accounts WHERE booking_slug = ${slug} LIMIT 1
    `
    const existingAccount = rows[0]

    if (existingAccount && existingAccount.email !== sessionEmail) {
      return NextResponse.json({
        error: 'This booking link is already taken'
      }, { status: 409 })
    }

    await sql`
      UPDATE google_accounts SET booking_slug = ${slug} WHERE email = ${sessionEmail}
    `

    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Error in PATCH /api/booking-slug:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
