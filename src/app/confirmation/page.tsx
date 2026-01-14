'use client'

import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import DynamicBackground from '@/components/ui/DynamicBackground'

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <DynamicBackground />
      <div className="relative z-10 max-w-md w-full">
        {/* Success Animation Container */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl">
          {/* Animated Checkmark */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse opacity-30" />
            <div className="absolute inset-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            You&apos;re booked!
          </h1>
          <p className="text-zinc-400 mb-8">
            A calendar invite has been sent to your email.
          </p>

          {/* What's Next Section */}
          <div className="bg-zinc-800/50 rounded-2xl p-5 mb-8 text-left space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-700/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-zinc-200 font-medium">Check your inbox</p>
                <p className="text-zinc-500 text-sm">Confirmation email sent</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-700/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-zinc-200 font-medium">Added to calendar</p>
                <p className="text-zinc-500 text-sm">Event synced automatically</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Logo */}
        <div className="flex justify-center mt-8">
          <Logo size="sm" href="/" />
        </div>
      </div>
    </div>
  )
}
