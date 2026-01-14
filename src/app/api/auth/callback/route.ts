import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTokensFromCode, getUserInfo } from '@/lib/google/oauth'
import { addOrUpdateGoogleAccount } from '@/lib/google/accounts'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'

  if (error) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=${error}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=missing_params`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get('oauth_state')?.value

  if (state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=invalid_state`)
  }

  try {
    const tokens = await getTokensFromCode(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=no_access_token`)
    }

    const userInfo = await getUserInfo(tokens.access_token)

    if (!userInfo.email) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=no_email`)
    }

    // Add or update Google account (supports multiple accounts)
    await addOrUpdateGoogleAccount(
      userInfo.email,
      userInfo.name || null,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date || null
    )

    // Set session cookie
    const sessionToken = Buffer.from(JSON.stringify({
      email: userInfo.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    })).toString('base64')

    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // Get redirect URL and clear oauth cookies
    const redirectTo = cookieStore.get('oauth_redirect')?.value || '/admin'
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_redirect')

    return NextResponse.redirect(`${baseUrl}${redirectTo}`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/admin/login?error=auth_failed`)
  }
}
