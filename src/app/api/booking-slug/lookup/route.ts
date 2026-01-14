import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET - Look up owner by booking slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    // Look up account by booking slug
    const { data: account, error } = await supabaseAdmin
      .from('google_accounts')
      .select('email, name')
      .eq('booking_slug', slug)
      .single()

    if (error || !account) {
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
