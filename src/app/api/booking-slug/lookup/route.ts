import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET - Look up owner by booking slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const rows = await sql`
      SELECT email, name FROM google_accounts WHERE booking_slug = ${slug} LIMIT 1
    `
    const account = rows[0]

    if (!account) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      email: account.email,
      name: account.name || 'Meeting'
    })
  } catch (error) {
    console.error('Error in GET /api/booking-slug/lookup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
