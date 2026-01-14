'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Logo from '@/components/ui/Logo'
import DynamicBackground from '@/components/ui/DynamicBackground'

interface Account {
  id: string
  email: string
  name: string | null
  is_primary: boolean
}

interface AccountsResponse {
  accounts: Account[]
  warning?: string
  error?: string
  needsMigration?: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [apiWarning, setApiWarning] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  // Booking slug state
  const [bookingSlug, setBookingSlug] = useState('')
  const [slugInput, setSlugInput] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchBookingSlug()
    }
  }, [authenticated])

  // Debounced slug availability check
  useEffect(() => {
    if (!slugInput || slugInput === bookingSlug) {
      setSlugAvailable(null)
      setSlugError(null)
      return
    }

    const timer = setTimeout(() => {
      checkSlugAvailability(slugInput)
    }, 500)

    return () => clearTimeout(timer)
  }, [slugInput, bookingSlug])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        setAuthenticated(true)
        fetchAccounts()
      } else {
        setAuthenticated(false)
        router.push('/admin/login')
      }
    } catch {
      setAuthenticated(false)
      router.push('/admin/login')
    }
  }

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      if (response.ok) {
        const data: AccountsResponse = await response.json()
        setAccounts(data.accounts || [])
        if (data.needsMigration) {
          setNeedsMigration(true)
        }
        if (data.warning) {
          setApiWarning(data.warning)
          console.warn('API warning:', data.warning)
        }
        if (data.error) {
          console.error('API error:', data.error)
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAccount = async (email: string) => {
    if (!confirm(`Remove ${email} from connected accounts?`)) return

    try {
      await fetch(`/api/accounts?email=${encodeURIComponent(email)}`, {
        method: 'DELETE'
      })
      fetchAccounts()
    } catch (error) {
      console.error('Failed to remove account:', error)
    }
  }

  const handleSetPrimary = async (accountId: string) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accountId, setPrimary: true })
      })
      if (response.ok) {
        fetchAccounts()
      }
    } catch (error) {
      console.error('Failed to set primary account:', error)
    }
  }

  const fetchBookingSlug = async () => {
    try {
      const response = await fetch('/api/booking-slug')
      if (response.ok) {
        const data = await response.json()
        setBookingSlug(data.slug || '')
        setSlugInput(data.slug || '')
      }
    } catch (error) {
      console.error('Failed to fetch booking slug:', error)
    }
  }

  const checkSlugAvailability = async (slug: string) => {
    setSlugChecking(true)
    setSlugError(null)
    try {
      const response = await fetch('/api/booking-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.toLowerCase() })
      })
      const data = await response.json()
      if (response.ok) {
        setSlugAvailable(data.available)
      } else {
        setSlugError(data.error)
        setSlugAvailable(false)
      }
    } catch (error) {
      console.error('Failed to check slug:', error)
      setSlugError('Failed to check availability')
    } finally {
      setSlugChecking(false)
    }
  }

  const handleSaveSlug = async () => {
    if (!slugInput || slugInput === bookingSlug) return

    setSlugSaving(true)
    setSlugError(null)
    setSlugSuccess(false)

    try {
      const response = await fetch('/api/booking-slug', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugInput.toLowerCase() })
      })
      const data = await response.json()

      if (response.ok) {
        setBookingSlug(data.slug)
        setSlugInput(data.slug)
        setSlugSuccess(true)
        setSlugAvailable(null)
        setTimeout(() => setSlugSuccess(false), 3000)
      } else {
        setSlugError(data.error)
      }
    } catch (error) {
      console.error('Failed to save slug:', error)
      setSlugError('Failed to save booking link')
    } finally {
      setSlugSaving(false)
    }
  }

  const getBookingUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    return `${baseUrl}/book/${bookingSlug}`
  }

  const copyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(getBookingUrl())
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (authenticated === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <DynamicBackground />
        <div className="animate-spin h-8 w-8 border-4 border-zinc-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <DynamicBackground />
      <header className="relative z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <Logo size="sm" showText={false} href="/" />
            <h1 className="text-xl font-bold text-zinc-100">Settings</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {needsMigration && (
          <div className="mb-6 p-4 bg-orange-950/50 border border-orange-800 rounded-lg">
            <h3 className="font-semibold text-orange-300 mb-2">Database Setup Required</h3>
            <p className="text-orange-400 text-sm mb-3">
              The multi-account feature requires a database table. Please run this SQL in your Supabase SQL Editor:
            </p>
            <pre className="bg-zinc-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`CREATE TABLE google_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  calendar_ids JSONB DEFAULT '["primary"]'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}
            </pre>
            <p className="text-orange-500 text-xs mt-2">
              After running the SQL, refresh this page and re-login with your Google account.
            </p>
          </div>
        )}
        {apiWarning && !needsMigration && (
          <div className="mb-6 p-4 bg-yellow-950/50 border border-yellow-800 rounded-lg text-yellow-400 text-sm">
            <strong>Warning:</strong> {apiWarning}
          </div>
        )}
        <div className="space-y-6">
          {/* Booking Link */}
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-zinc-800 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Your Booking Link</h2>
              <p className="text-sm text-zinc-400">
                Share this link with people who want to book time with you
              </p>
            </div>

            {/* Current booking URL */}
            {bookingSlug && (
              <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg flex items-center justify-between">
                <code className="text-sm text-zinc-300 truncate">
                  {getBookingUrl()}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyBookingLink}
                >
                  Copy
                </Button>
              </div>
            )}

            {/* Edit booking slug */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-300">
                Customize your link
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm">{process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/book/</span>
                <Input
                  type="text"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-name"
                  className="flex-1"
                />
              </div>

              {/* Status indicators */}
              {slugChecking && (
                <p className="text-sm text-zinc-400">Checking availability...</p>
              )}
              {slugAvailable === true && slugInput !== bookingSlug && (
                <p className="text-sm text-green-400">This link is available</p>
              )}
              {slugAvailable === false && (
                <p className="text-sm text-red-400">{slugError || 'This link is not available'}</p>
              )}
              {slugSuccess && (
                <p className="text-sm text-green-400">Booking link saved successfully!</p>
              )}

              <Button
                onClick={handleSaveSlug}
                disabled={!slugInput || slugInput === bookingSlug || slugAvailable === false || slugSaving}
              >
                {slugSaving ? 'Saving...' : 'Save Link'}
              </Button>
            </div>
          </div>

          {/* Connected Google Accounts */}
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Connected Calendars</h2>
                <p className="text-sm text-zinc-400">
                  Add multiple Google accounts to aggregate availability
                </p>
              </div>
              <a
                href="/api/auth/google"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Account
              </a>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-8 bg-zinc-800/50 rounded-lg">
                <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-zinc-400">No calendars connected</p>
                <p className="text-sm text-zinc-500 mt-1">Add a Google account to sync your availability</p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100">
                          {account.name || account.email}
                          {account.is_primary && (
                            <span className="ml-2 text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-zinc-400">{account.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.is_primary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPrimary(account.id)}
                        >
                          Set Primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAccount(account.email)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">How it works</h2>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-zinc-700 text-zinc-300 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                <span>Connect multiple Google Calendar accounts</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-zinc-700 text-zinc-300 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                <span>Availability is calculated by checking ALL connected calendars</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-zinc-700 text-zinc-300 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                <span>Only times that are FREE on ALL calendars are shown as available</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-zinc-700 text-zinc-300 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                <span>When someone books, a calendar invite is sent to both of you</span>
              </li>
            </ul>
          </div>

        </div>
      </main>
    </div>
  )
}
