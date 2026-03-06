import { sql } from '@/lib/db'
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
  owner_email: string | null
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

export async function getAllGoogleAccounts(ownerEmail?: string): Promise<GoogleAccount[]> {
  const rows = await sql`
    SELECT * FROM google_accounts ORDER BY is_primary DESC
  `

  const allAccounts = rows as GoogleAccount[]

  console.log('getAllGoogleAccounts called with ownerEmail:', ownerEmail)
  console.log('Total accounts in DB:', allAccounts.length)

  if (!ownerEmail) {
    console.log('No ownerEmail filter, returning all accounts')
    return allAccounts
  }

  const filtered = allAccounts.filter(account => {
    const match = account.owner_email === ownerEmail
    console.log(`  ${account.email}: owner_email="${account.owner_email}" ${match ? 'MATCH' : 'NO MATCH'}`)
    return match
  })

  console.log('Filtered result:', filtered.length, 'accounts')
  return filtered
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
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null

        await sql`
          UPDATE google_accounts
          SET google_access_token = ${encrypt(credentials.access_token)},
              google_token_expiry = ${newExpiry}
          WHERE id = ${account.id}
        `

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
  tokenExpiry: number | null,
  ownerEmail?: string // The user who owns this account
): Promise<void> {
  const effectiveOwner = ownerEmail || email

  console.log('addOrUpdateGoogleAccount:', { email, ownerEmail, effectiveOwner })

  const existing = await sql`
    SELECT id FROM google_accounts WHERE email = ${email} LIMIT 1
  `

  const userAccounts = await sql`
    SELECT id FROM google_accounts WHERE owner_email = ${effectiveOwner}
  `

  const isPrimary = userAccounts.length === 0

  const encryptedAccessToken = encrypt(accessToken)
  const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null
  const expiryIso = tokenExpiry ? new Date(tokenExpiry).toISOString() : null

  if (existing.length > 0) {
    const existingId = existing[0].id

    const existingFull = await sql`
      SELECT calendar_ids FROM google_accounts WHERE id = ${existingId} LIMIT 1
    `

    const needsCalendarIds = !existingFull[0]?.calendar_ids ||
      (Array.isArray(existingFull[0].calendar_ids) && existingFull[0].calendar_ids.length === 0)

    if (needsCalendarIds) {
      await sql`
        UPDATE google_accounts
        SET name = ${name},
            google_access_token = ${encryptedAccessToken},
            google_refresh_token = ${encryptedRefreshToken},
            google_token_expiry = ${expiryIso},
            owner_email = ${effectiveOwner},
            is_primary = ${isPrimary},
            calendar_ids = ${JSON.stringify(['primary'])}::jsonb
        WHERE id = ${existingId}
      `
    } else {
      await sql`
        UPDATE google_accounts
        SET name = ${name},
            google_access_token = ${encryptedAccessToken},
            google_refresh_token = ${encryptedRefreshToken},
            google_token_expiry = ${expiryIso},
            owner_email = ${effectiveOwner},
            is_primary = ${isPrimary}
        WHERE id = ${existingId}
      `
    }
    console.log('Updated Google account:', email, 'owner_email set to:', effectiveOwner)
  } else {
    await sql`
      INSERT INTO google_accounts (email, name, google_access_token, google_refresh_token, google_token_expiry, is_primary, owner_email, calendar_ids)
      VALUES (${email}, ${name}, ${encryptedAccessToken}, ${encryptedRefreshToken}, ${expiryIso}, ${isPrimary}, ${effectiveOwner}, '["primary"]'::jsonb)
    `
    console.log('Inserted new Google account:', email, 'isPrimary:', isPrimary)
  }

  // Ensure owner_settings exists for this owner
  const existingSettings = await sql`
    SELECT id FROM owner_settings WHERE email = ${effectiveOwner} LIMIT 1
  `

  if (existingSettings.length === 0) {
    const defaultSchedule = {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: []
    }

    await sql`
      INSERT INTO owner_settings (email, name, weekly_schedule, timezone, slot_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days)
      VALUES (${effectiveOwner}, ${name || effectiveOwner.split('@')[0]}, ${JSON.stringify(defaultSchedule)}::jsonb, 'America/New_York', 30, 0, 24, 30)
    `
    console.log('Created owner_settings for:', effectiveOwner)
  }
}

export async function removeGoogleAccount(email: string): Promise<void> {
  await sql`DELETE FROM google_accounts WHERE email = ${email}`
}

export async function getPrimaryAccount(ownerEmail?: string): Promise<GoogleAccount | null> {
  const allPrimary = await sql`
    SELECT * FROM google_accounts WHERE is_primary = true
  `

  if (allPrimary.length === 0) {
    return null
  }

  if (!ownerEmail) {
    return allPrimary[0] as GoogleAccount
  }

  const account = allPrimary.find(a => {
    if (a.owner_email === ownerEmail) return true
    if (!a.owner_email && a.email === ownerEmail) return true
    return false
  })

  return (account as GoogleAccount) || null
}
