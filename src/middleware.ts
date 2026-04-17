// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth/login', '/api/auth/signup']
const COOKIE_NAME  = 'toonforge_session'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/media') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Parse and unseal the session cookie directly from the header
  // to avoid RequestCookies vs CookieStore type incompatibility
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${COOKIE_NAME}=`))

  let userId: string | undefined

  if (match) {
    const sealed = match.slice(COOKIE_NAME.length + 1)
    try {
      const data = await unsealData<SessionData>(sealed, {
        password: process.env.SESSION_SECRET as string,
      })
      userId = data?.userId
    } catch {
      userId = undefined
    }
  }

  if (!userId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
