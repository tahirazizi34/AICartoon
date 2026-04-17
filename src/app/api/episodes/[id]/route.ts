// src/app/api/episodes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/session'
import { getPublicUrl } from '@/lib/storage'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async (_, session) => {
    const episode = await db.episode.findFirst({
      where: { id: params.id, userId: session.userId },
    })

    if (!episode) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...episode,
      thumbnailUrl: episode.thumbnailPath ? getPublicUrl(episode.thumbnailPath) : null,
      videoUrl:     episode.videoPath     ? getPublicUrl(episode.videoPath)     : null,
    })
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async (_, session) => {
    const episode = await db.episode.findFirst({
      where: { id: params.id, userId: session.userId },
      select: { id: true, videoPath: true, thumbnailPath: true },
    })

    if (!episode) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Best-effort S3 cleanup
    if (episode.videoPath || episode.thumbnailPath) {
      try {
        const { deleteFile } = await import('@/lib/storage')
        await Promise.allSettled([
          episode.videoPath     && deleteFile(episode.videoPath),
          episode.thumbnailPath && deleteFile(episode.thumbnailPath),
        ])
      } catch {
        // Non-fatal — DB record deletion is the priority
      }
    }

    await db.episode.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  })
}
