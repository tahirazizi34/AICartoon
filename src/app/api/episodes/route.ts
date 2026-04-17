// src/app/api/episodes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/session'

// GET /api/episodes — list episodes for current user
export async function GET(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    const { searchParams } = new URL(req.url)
    const page   = parseInt(searchParams.get('page')  || '1')
    const limit  = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined

    const [episodes, total] = await Promise.all([
      db.episode.findMany({
        where: { userId: session.userId, ...(status && { status: status as any }) },
        orderBy: { episodeNumber: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          description: true,
          status: true,
          youtubeVideoId: true,
          youtubeUrl: true,
          thumbnailPath: true,
          viewCount: true,
          likeCount: true,
          publishedAt: true,
          createdAt: true,
          errorMessage: true,
        },
      }),
      db.episode.count({ where: { userId: session.userId } }),
    ])

    // Map storage keys to public URLs
    const { getPublicUrl } = await import('@/lib/storage')
    const mapped = episodes.map((ep) => ({
      ...ep,
      thumbnailUrl: ep.thumbnailPath ? getPublicUrl(ep.thumbnailPath) : null,
    }))

    return NextResponse.json({ episodes: mapped, total, page, pages: Math.ceil(total / limit) })
  })
}
