// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/session'
import { generateEpisodeForUser } from '@/lib/generation-pipeline'

// POST /api/generate — trigger a manual episode generation
export async function POST(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    // Fire and forget — return immediately, generation runs in background
    generateEpisodeForUser(session.userId).catch((err) => {
      console.error(`[Generate] Failed for user ${session.userId}:`, err.message)
    })

    return NextResponse.json({ ok: true, message: 'Generation started' })
  })
}
