import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = [
  '/admin/login',
  '/api/',
  '/_next/',
  '/favicon',
  '/icons/',
  '/manifest.json',
]

// Routes that are public for booking
const publicBookingRoutes = [
  '/book/',      // /book/[slug] - someone's booking link
  '/confirmation',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  for (const route of publicRoutes) {
    if (pathname.startsWith(route) || pathname === route) {
      return NextResponse.next()
    }
  }

  // Allow public booking routes (someone's booking link)
  for (const route of publicBookingRoutes) {
    if (pathname.startsWith(route)) {
      return NextResponse.next()
    }
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('session')?.value

  if (!sessionCookie) {
    // No session, redirect to login
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    // Validate session
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())

    if (session.exp < Date.now()) {
      // Session expired, redirect to login
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('session')
      return response
    }

    // Session valid, continue
    return NextResponse.next()
  } catch {
    // Invalid session, redirect to login
    const loginUrl = new URL('/admin/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('session')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
