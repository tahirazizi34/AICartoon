export const dynamic = 'force-dynamic'
// src/app/api/cron/sync-stats/route.ts
/**
 * Railway Cron: runs nightly to pull updated view/like counts from YouTube.
 *
 * Add in Railway → Cron Jobs:
 *   Schedule: 0 3 * * *   (3 AM daily)
 *   Command:  curl -s -X POST https://YOUR-APP.railway.app/api/cron/sync-stats \
 *               -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncViewCounts } from '@/lib/youtube/client'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await db.user.findMany({
    select: { id: true, email: true },
    where: {
      // Only sync users who have YouTube connected and at least one published episode
      youtubeAuth: { isNot: null },
      episodes:    { some: { youtubeVideoId: { not: null } } },
    },
  })

  const results: Array<{ userId: string; status: string; error?: string }> = []

  for (const user of users) {
    try {
      await syncViewCounts(user.id)
      results.push({ userId: user.id, status: 'synced' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[SyncStats] Failed for ${user.id}:`, msg)
      results.push({ userId: user.id, status: 'error', error: msg })
    }
  }

  console.log(`[SyncStats] Done. ${results.length} users processed.`)
  return NextResponse.json({ ok: true, results })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
