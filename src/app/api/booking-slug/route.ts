import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

    // First try google_accounts table
    const { data: account, error } = await supabaseAdmin
      .from('google_accounts')
      .select('booking_slug')
      .eq('email', sessionEmail)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching booking slug:', error)
      return NextResponse.json({ error: 'Failed to fetch booking slug' }, { status: 500 })
    }

    // Generate a default slug if none exists
    const slug = account?.booking_slug || generateSlug()

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

    // Validate slug format
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

    // Check if slug is taken by someone else
    const { data: existingAccount } = await supabaseAdmin
      .from('google_accounts')
      .select('email')
      .eq('booking_slug', slug)
      .single()

    // Slug is available if no one has it, or if current user owns it
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

    // Validate slug format
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

    // Check if slug is taken by someone else
    const { data: existingAccount } = await supabaseAdmin
      .from('google_accounts')
      .select('email')
      .eq('booking_slug', slug)
      .single()

    if (existingAccount && existingAccount.email !== sessionEmail) {
      return NextResponse.json({
        error: 'This booking link is already taken'
      }, { status: 409 })
    }

    // Update the slug
    const { error: updateError } = await supabaseAdmin
      .from('google_accounts')
      .update({ booking_slug: slug })
      .eq('email', sessionEmail)

    if (updateError) {
      console.error('Error updating booking slug:', updateError)
      return NextResponse.json({ error: 'Failed to update booking slug' }, { status: 500 })
    }

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
