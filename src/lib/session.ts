// src/lib/session.ts
import { getIronSession, IronSession } from 'iron-session'
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

// For use in Server Components and Route Handlers (reads from next/headers)
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession()
  if (!session.userId) throw new Error('UNAUTHORIZED')
  return session
}

// For use inside API Route Handlers (reads from NextRequest)
export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await getIronSession<SessionData>(req.cookies, sessionOptions)
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, session)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
