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
  // First, try to fetch all accounts and filter in code (more resilient to missing columns)
  const { data: allData, error } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .order('is_primary', { ascending: false })

  if (error) {
    console.error('Error fetching google_accounts:', error.message)
    return []
  }

  const allAccounts = (allData || []) as GoogleAccount[]

  console.log('getAllGoogleAccounts called with ownerEmail:', ownerEmail)
  console.log('Total accounts in DB:', allAccounts.length)

  // If no ownerEmail filter, return all (should rarely happen in production)
  if (!ownerEmail) {
    console.log('No ownerEmail filter, returning all accounts')
    return allAccounts
  }

  // Filter accounts - ONLY show accounts where owner_email matches exactly
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
  tokenExpiry: number | null,
  ownerEmail?: string // The user who owns this account
): Promise<void> {
  // If no ownerEmail provided, the account owns itself (initial login)
  const effectiveOwner = ownerEmail || email

  console.log('addOrUpdateGoogleAccount:', { email, ownerEmail, effectiveOwner })

  const { data: existing } = await supabaseAdmin
    .from('google_accounts')
    .select('id')
    .eq('email', email)
    .single()

  // Check if this owner already has any accounts with proper owner_email
  const { data: userAccounts } = await supabaseAdmin
    .from('google_accounts')
    .select('id')
    .eq('owner_email', effectiveOwner)

  // This should be primary if the owner has no other accounts
  const isPrimary = !userAccounts || userAccounts.length === 0

  // Base data without owner_email (in case column doesn't exist)
  const baseData = {
    name,
    google_access_token: encrypt(accessToken),
    google_refresh_token: refreshToken ? encrypt(refreshToken) : null,
    google_token_expiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : null,
  }

  if (existing) {
    // Check if calendar_ids needs to be set (if empty or null)
    const { data: existingFull } = await supabaseAdmin
      .from('google_accounts')
      .select('calendar_ids')
      .eq('id', existing.id)
      .single()

    const needsCalendarIds = !existingFull?.calendar_ids ||
      (Array.isArray(existingFull.calendar_ids) && existingFull.calendar_ids.length === 0)

    // Build update data - always update owner_email and is_primary for fresh logins
    const updateData: Record<string, unknown> = {
      ...baseData,
      owner_email: effectiveOwner,
      is_primary: isPrimary, // Set primary if this user has no other accounts
    }
    if (needsCalendarIds) {
      updateData.calendar_ids = ['primary']
    }

    let { error: updateError } = await supabaseAdmin
      .from('google_accounts')
      .update(updateData)
      .eq('id', existing.id)

    // If owner_email column doesn't exist, try without it
    if (updateError?.message?.includes('owner_email')) {
      const fallbackData: Record<string, unknown> = { ...baseData, is_primary: isPrimary }
      if (needsCalendarIds) {
        fallbackData.calendar_ids = ['primary']
      }
      const result = await supabaseAdmin
        .from('google_accounts')
        .update(fallbackData)
        .eq('id', existing.id)
      updateError = result.error
    }
    console.log('Updated Google account:', email, 'owner_email set to:', effectiveOwner, 'Error:', updateError?.message || 'none')
  } else {
    // Try insert with owner_email first, fall back without
    // Always set calendar_ids to ['primary'] for new accounts
    let { error: insertError } = await supabaseAdmin
      .from('google_accounts')
      .insert({
        email,
        ...baseData,
        is_primary: isPrimary,
        owner_email: effectiveOwner,
        calendar_ids: ['primary']
      })

    // If owner_email column doesn't exist, try without it
    if (insertError?.message?.includes('owner_email')) {
      const result = await supabaseAdmin
        .from('google_accounts')
        .insert({
          email,
          ...baseData,
          is_primary: isPrimary,
          calendar_ids: ['primary']
        })
      insertError = result.error
    }
    console.log('Inserted new Google account:', email, 'isPrimary:', isPrimary, 'Error:', insertError?.message || 'none')
  }
}

export async function removeGoogleAccount(email: string): Promise<void> {
  await supabaseAdmin
    .from('google_accounts')
    .delete()
    .eq('email', email)
}

export async function getPrimaryAccount(ownerEmail?: string): Promise<GoogleAccount | null> {
  // Fetch all primary accounts and filter in code (resilient to missing owner_email column)
  const { data: allPrimary, error } = await supabaseAdmin
    .from('google_accounts')
    .select('*')
    .eq('is_primary', true)

  if (error || !allPrimary || allPrimary.length === 0) {
    return null
  }

  if (!ownerEmail) {
    return allPrimary[0] as GoogleAccount
  }

  // Filter to find primary account for this owner
  const account = allPrimary.find(a => {
    if (a.owner_email === ownerEmail) return true
    if (!a.owner_email && a.email === ownerEmail) return true
    return false
  })

  return (account as GoogleAccount) || null
}
