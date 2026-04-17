// src/lib/session.ts
import { getIronSession, IronSession, unsealData } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export interface SessionData {
  userId: string
  email: string
  studioName: string
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'toonforge_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
  },
}

const COOKIE_NAME = 'toonforge_session'

// For Server Components / Route Handlers that use next/headers cookies()
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession()
  if (!session.userId) throw new Error('UNAUTHORIZED')
  return session
}

// Read + decrypt session data from a NextRequest cookie header directly.
// Avoids the RequestCookies vs CookieStore type incompatibility in iron-session v8.
async function getSessionDataFromRequest(req: NextRequest): Promise<SessionData | null> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  // Parse the specific session cookie value from the header string
  const match = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${COOKIE_NAME}=`))

  if (!match) return null

  const sealed = match.slice(COOKIE_NAME.length + 1)
  if (!sealed) return null

  try {
    const data = await unsealData<SessionData>(sealed, {
      password: process.env.SESSION_SECRET as string,
    })
    return data?.userId ? data : null
  } catch {
    return null
  }
}

// For API Route Handlers — wraps a handler with session auth check
export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const sessionData = await getSessionDataFromRequest(req)
  if (!sessionData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handler(req, sessionData)
}
