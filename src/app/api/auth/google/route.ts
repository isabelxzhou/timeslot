import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthUrl } from '@/lib/google/oauth'

export async function GET() {
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })

  const authUrl = getAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
