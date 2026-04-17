export const dynamic = 'force-dynamic'
// src/app/api/episodes/[id]/retry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/session'
import { generateEpisodeForUser } from '@/lib/generation-pipeline'
import { EpisodeStatus } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async (_, session) => {
    const episode = await db.episode.findFirst({
      where: { id: params.id, userId: session.userId },
      select: { id: true, status: true, episodeNumber: true },
    })

    if (!episode) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (episode.status !== EpisodeStatus.FAILED) {
      return NextResponse.json({ error: 'Only failed episodes can be retried' }, { status: 400 })
    }

    // Reset to queued so the pipeline creates a fresh attempt
    await db.episode.update({
      where: { id: params.id },
      data: {
        status: EpisodeStatus.QUEUED,
        errorMessage: null,
        generationLog: `[${new Date().toISOString()}] Retry initiated\n`,
      },
    })

    // Fire generation for this user (will pick up the next episode number)
    generateEpisodeForUser(session.userId).catch((err) => {
      console.error(`[Retry] Failed for episode ${params.id}:`, err.message)
    })

    return NextResponse.json({ ok: true })
  })
}
