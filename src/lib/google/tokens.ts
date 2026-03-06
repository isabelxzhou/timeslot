import { sql } from '@/lib/db'
import { refreshAccessToken } from './oauth'
import { encrypt, decrypt } from '@/lib/utils/encryption'

export async function getValidAccessToken(): Promise<string | null> {
  const rows = await sql`
    SELECT * FROM owner_settings LIMIT 1
  `
  const settings = rows[0]

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
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null

        await sql`
          UPDATE owner_settings
          SET google_access_token = ${encrypt(credentials.access_token)},
              google_token_expiry = ${newExpiry}
          WHERE id = ${settings.id}
        `

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
  const rows = await sql`
    SELECT * FROM owner_settings LIMIT 1
  `
  return rows[0] || null
}
