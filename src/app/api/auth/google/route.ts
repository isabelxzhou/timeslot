import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthUrl } from '@/lib/google/oauth'

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID()
  const { searchParams } = new URL(request.url)
  const redirect = searchParams.get('redirect') || '/admin'

  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })

  // Store redirect URL for after auth
  cookieStore.set('oauth_redirect', redirect, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })

  const authUrl = getAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
