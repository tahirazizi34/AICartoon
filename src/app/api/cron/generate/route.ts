export const dynamic = 'force-dynamic'
// src/app/api/cron/generate/route.ts
/**
 * Railway Cron Job endpoint.
 *
 * In Railway dashboard → your service → "Cron Jobs":
 *   Schedule:  0 * * * *   (every hour — adjust to match your episode count)
 *   Command:   curl -X POST https://your-app.railway.app/api/cron/generate
 *              -H "Authorization: Bearer $CRON_SECRET"
 *
 * For 10 episodes/day spread across the day, set multiple cron jobs
 * at your preferred times, or set one job and let settings.scheduleSlots
 * decide whether to actually generate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateEpisodeForUser } from '@/lib/generation-pipeline'

// Simple bearer token to prevent unauthorized triggers
const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const currentSlot = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  // Also match on the hour boundary (e.g. "08:00" matches calls at 08:00-08:59)
  const currentHour = `${String(now.getHours()).padStart(2, '0')}:00`

  console.log(`[Cron] Triggered at ${currentSlot}`)

  // Find all users with schedule enabled
  const allSettings = await db.studioSettings.findMany({
    where: { scheduleEnabled: true },
    select: { userId: true, scheduleSlots: true, episodesPerDay: true },
  })

  const results: Array<{ userId: string; status: string; episodeId?: string }> = []

  for (const settings of allSettings) {
    const slots = settings.scheduleSlots.split(',').map(s => s.trim())
    const shouldRun = slots.includes(currentSlot) || slots.includes(currentHour)

    if (!shouldRun) {
      results.push({ userId: settings.userId, status: 'skipped (not scheduled)' })
      continue
    }

    // Don't double-generate in the same slot (45-min dedup window)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const recentEp = await db.episode.findFirst({
      where: {
        userId: settings.userId,
        createdAt: { gte: new Date(now.getTime() - 45 * 60 * 1000) },
        status: { not: 'FAILED' },
      },
    })

    if (recentEp) {
      results.push({ userId: settings.userId, status: 'skipped (recent episode exists)' })
      continue
    }

    // Run generation — async, don't await in cron response
    // Railway cron jobs have a 10s response timeout, so we fire and forget
    generateEpisodeForUser(settings.userId)
      .then(id => console.log(`[Cron] Episode ${id} done for ${settings.userId}`))
      .catch(err => console.error(`[Cron] Failed for ${settings.userId}:`, err.message))

    results.push({ userId: settings.userId, status: 'started' })
  }

  console.log(`[Cron] Results:`, results)
  return NextResponse.json({ ok: true, slot: currentSlot, results })
}

// Also support GET for easy browser-based testing
export async function GET(req: NextRequest) {
  return POST(req)
}
