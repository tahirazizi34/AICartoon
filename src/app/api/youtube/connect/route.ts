export const dynamic = 'force-dynamic'
// src/app/api/youtube/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/session'
import { getAuthUrl } from '@/lib/youtube/client'

// GET /api/youtube/connect — redirect user to Google OAuth
export async function GET(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    const url = getAuthUrl(session.userId)
    return NextResponse.redirect(url)
  })
}
