import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())

    if (session.exp < Date.now()) {
      return NextResponse.json({ authenticated: false, reason: 'expired' }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      email: session.email
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('session')

  return NextResponse.json({ success: true })
}
