import { supabaseAdmin } from '@/lib/supabase/admin'
import { refreshAccessToken } from './oauth'
import { encrypt, decrypt } from '@/lib/utils/encryption'

export interface GoogleAccount {
  id: string
  email: string
  name: string | null
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: string | null
  calendar_ids: string[]
  is_primary: boolean
  booking_slug: string | null
}

// Generate a random booking slug
function generateBookingSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function getAllGoogleAccounts(): Promise<GoogleAccount[]> {
  const { data, error } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .order('is_primary', { ascending: false })

  if (error) {
    console.error('Error fetching google_accounts:', error.message)
    return []
  }

  return (data || []) as GoogleAccount[]
}

export async function getValidAccessTokenForAccount(account: GoogleAccount): Promise<string | null> {
  if (!account.google_access_token || !account.google_refresh_token) {
    return null
  }

  const tokenExpiry = account.google_token_expiry
    ? new Date(account.google_token_expiry)
    : new Date(0)
  const now = new Date()

  // If token expires in less than 5 minutes, refresh it
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const decryptedRefreshToken = decrypt(account.google_refresh_token)
      const credentials = await refreshAccessToken(decryptedRefreshToken)

      if (credentials.access_token) {
        await supabaseAdmin
          .from('google_accounts')
          .update({
            google_access_token: encrypt(credentials.access_token),
            google_token_expiry: credentials.expiry_date
              ? new Date(credentials.expiry_date).toISOString()
              : null
          })
          .eq('id', account.id)

        return credentials.access_token
      }
    } catch (error) {
      console.error('Failed to refresh token for', account.email, error)
      return null
    }
  }

  return decrypt(account.google_access_token)
}

export async function addOrUpdateGoogleAccount(
  email: string,
  name: string | null,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: number | null
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('google_accounts')
    .select('id')
    .eq('email', email)
    .single()

  const { data: anyAccounts } = await supabaseAdmin
    .from('google_accounts')
    .select('id')
    .limit(1)

  const isPrimary = !anyAccounts || anyAccounts.length === 0

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('google_accounts')
      .update({
        name,
        google_access_token: encrypt(accessToken),
        google_refresh_token: refreshToken ? encrypt(refreshToken) : null,
        google_token_expiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : null
      })
      .eq('id', existing.id)
    console.log('Updated Google account:', email, 'Error:', updateError)
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('google_accounts')
      .insert({
        email,
        name,
        google_access_token: encrypt(accessToken),
        google_refresh_token: refreshToken ? encrypt(refreshToken) : null,
        google_token_expiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : null,
        is_primary: isPrimary
      })
    console.log('Inserted new Google account:', email, 'isPrimary:', isPrimary, 'Error:', insertError)
  }
}

export async function removeGoogleAccount(email: string): Promise<void> {
  await supabaseAdmin
    .from('google_accounts')
    .delete()
    .eq('email', email)
}

export async function getPrimaryAccount(): Promise<GoogleAccount | null> {
  const { data } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .eq('is_primary', true)
    .single()

  return data as GoogleAccount | null
}
