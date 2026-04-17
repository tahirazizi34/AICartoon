export const dynamic = 'force-dynamic'
// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/session'
import { encrypt, maybeDecrypt } from '@/lib/crypto'

const schema = z.object({
  episodesPerDay:     z.number().int().min(1).max(50).optional(),
  episodeDuration:    z.number().int().min(30).max(600).optional(),
  artStyle:           z.string().optional(),
  genre:              z.string().optional(),
  characterNames:     z.string().optional(),
  scheduleEnabled:    z.boolean().optional(),
  scheduleSlots:      z.string().optional(),
  timezone:           z.string().optional(),
  autoPublish:        z.boolean().optional(),
  defaultVisibility:  z.string().optional(),
  addToPlaylist:      z.boolean().optional(),
  playlistId:         z.string().optional(),
  autoCaptions:       z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  // API keys — stored encrypted
  anthropicKey:       z.string().optional(),
  replicateKey:       z.string().optional(),
  elevenLabsKey:      z.string().optional(),
})

// GET /api/settings
export async function GET(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    const settings = await db.studioSettings.findUnique({
      where: { userId: session.userId },
    })
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    // Redact API keys — return masked versions
    const masked = {
      ...settings,
      anthropicKey:  settings.anthropicKey  ? '••••••••••••••••' : null,
      replicateKey:  settings.replicateKey  ? '••••••••••••••••' : null,
      elevenLabsKey: settings.elevenLabsKey ? '••••••••••••••••' : null,
    }
    return NextResponse.json(masked)
  })
}

// PATCH /api/settings
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (_, session) => {
    try {
      const body = await req.json()
      const data = schema.parse(body)

      // Encrypt API keys before storing
      const updateData: Record<string, unknown> = { ...data }
      if (data.anthropicKey && !data.anthropicKey.startsWith('•')) {
        updateData.anthropicKey = encrypt(data.anthropicKey)
      } else {
        delete updateData.anthropicKey
      }
      if (data.replicateKey && !data.replicateKey.startsWith('•')) {
        updateData.replicateKey = encrypt(data.replicateKey)
      } else {
        delete updateData.replicateKey
      }
      if (data.elevenLabsKey && !data.elevenLabsKey.startsWith('•')) {
        updateData.elevenLabsKey = encrypt(data.elevenLabsKey)
      } else {
        delete updateData.elevenLabsKey
      }

      const settings = await db.studioSettings.upsert({
        where:  { userId: session.userId },
        create: { userId: session.userId, ...updateData },
        update: updateData,
      })

      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
      }
      console.error('Settings update error:', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  })
}
