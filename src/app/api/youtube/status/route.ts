export const dynamic = 'force-dynamic'
// src/app/api/youtube/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    const auth = await db.youTubeAuth.findUnique({
      where: { userId: session.userId },
      select: { channelName: true, channelHandle: true, subscriberCount: true },
    })
    if (!auth) return NextResponse.json({ connected: false })
    return NextResponse.json({ connected: true, ...auth })
  })
}
