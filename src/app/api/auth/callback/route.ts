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

    // Check if this is an "add account" flow (from settings page)
    const oauthRedirect = cookieStore.get('oauth_redirect')?.value || '/admin'
    const isAddAccountFlow = oauthRedirect.includes('/settings')

    console.log('=== OAuth Callback ===')
    console.log('User email from Google:', userInfo.email)
    console.log('Redirect to:', oauthRedirect)
    console.log('Is add account flow:', isAddAccountFlow)

    let ownerEmail: string | undefined

    if (isAddAccountFlow) {
      // Adding account from settings - use existing session owner
      const existingSession = cookieStore.get('session')?.value
      if (existingSession) {
        try {
          const session = JSON.parse(Buffer.from(existingSession, 'base64').toString())
          if (session.exp > Date.now()) {
            ownerEmail = session.email
            console.log('Adding account to existing user:', ownerEmail)
          }
        } catch {
          // Invalid session, ignore
        }
      }
    }
    // If not add account flow, ownerEmail stays undefined = fresh login

    // Add or update Google account (with owner tracking)
    await addOrUpdateGoogleAccount(
      userInfo.email,
      userInfo.name || null,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date || null,
      ownerEmail // If undefined, the account owns itself
    )

    // Clear oauth cookies first
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_redirect')

    // Create redirect response
    const redirectResponse = NextResponse.redirect(`${baseUrl}${oauthRedirect}`)

    // ALWAYS create new session for fresh logins (not adding account)
    if (!isAddAccountFlow) {
      console.log('FRESH LOGIN - Creating new session for:', userInfo.email)

      const sessionToken = Buffer.from(JSON.stringify({
        email: userInfo.email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      })).toString('base64')

      // Set cookie on the response object to ensure it persists through redirect
      redirectResponse.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })
      console.log('Session cookie set on response for:', userInfo.email)
    } else {
      console.log('ADD ACCOUNT FLOW - Keeping existing session')
    }

    return redirectResponse
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/admin/login?error=auth_failed`)
  }
}
