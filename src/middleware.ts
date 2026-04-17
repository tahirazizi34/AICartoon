// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth/login', '/api/auth/signup']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/media') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check session
  const session = await getIronSession<SessionData>(req.cookies, {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'toonforge_session',
  })

  if (!session.userId) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
