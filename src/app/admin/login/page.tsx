'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import DynamicBackground from '@/components/ui/DynamicBackground'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const redirect = searchParams.get('redirect') || '/admin'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <DynamicBackground />
      <div className="max-w-sm w-full relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={false} href={undefined} />
          </div>
          <h1 className="text-2xl font-bold text-white">sign in to timeslot</h1>
          <p className="text-zinc-400 mt-1">manage your bookings and calendar</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-800/50 rounded-lg text-red-400 text-sm">
            {error === 'auth_failed' && 'Authentication failed. Please try again.'}
            {error === 'invalid_state' && 'Invalid request. Please try again.'}
            {error === 'missing_params' && 'Missing parameters. Please try again.'}
            {!['auth_failed', 'invalid_state', 'missing_params'].includes(error) && 'An error occurred.'}
          </div>
        )}

        <a
          href={`/api/auth/google?redirect=${encodeURIComponent(redirect)}`}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="font-medium text-white">sign in with google</span>
        </a>

        <p className="mt-6 text-center text-xs text-zinc-500">
          connect your google account to get started
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
