import { supabaseAdmin } from '@/lib/supabase/admin'
import { refreshAccessToken } from './oauth'
import { encrypt, decrypt } from '@/lib/utils/encryption'

export async function getValidAccessToken(): Promise<string | null> {
  const { data: settings } = await supabaseAdmin
    .from('owner_settings')
    .select('*')
    .limit(1)
    .single()

  if (!settings?.google_access_token || !settings?.google_refresh_token) {
    return null
  }

  const tokenExpiry = settings.google_token_expiry
    ? new Date(settings.google_token_expiry)
    : new Date(0)
  const now = new Date()

  // If token expires in less than 5 minutes, refresh it
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const decryptedRefreshToken = decrypt(settings.google_refresh_token)
      const credentials = await refreshAccessToken(decryptedRefreshToken)

      if (credentials.access_token) {
        await supabaseAdmin
          .from('owner_settings')
          .update({
            google_access_token: encrypt(credentials.access_token),
            google_token_expiry: credentials.expiry_date
              ? new Date(credentials.expiry_date).toISOString()
              : null
          })
          .eq('id', settings.id)

        return credentials.access_token
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      return null
    }
  }

  return decrypt(settings.google_access_token)
}

export async function getOwnerSettings() {
  const { data: settings } = await supabaseAdmin
    .from('owner_settings')
    .select('*')
    .limit(1)
    .single()

  return settings
}
