export const dynamic = 'force-dynamic'
// src/app/api/youtube/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    await db.youTubeAuth.deleteMany({ where: { userId: session.userId } })
    return NextResponse.json({ ok: true })
  })
}
