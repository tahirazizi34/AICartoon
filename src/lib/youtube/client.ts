// src/lib/youtube/client.ts
import { google, youtube_v3 } from 'googleapis'
import fs from 'fs'
import { db } from '@/lib/db'

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
)

// ─── Auth URL generation ─────────────────────────────────────────────────────

export function getAuthUrl(userId: string): string {
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64')
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube',
    ],
    prompt: 'consent',
    state,
  })
}

// ─── OAuth callback handling ─────────────────────────────────────────────────

export async function handleOAuthCallback(code: string, userId: string): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Fetch channel info
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
  const channelRes = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    mine: true,
  })

  const channel = channelRes.data.items?.[0]
  if (!channel) throw new Error('No YouTube channel found for this account')

  await db.youTubeAuth.upsert({
    where: { userId },
    create: {
      userId,
      channelId: channel.id!,
      channelName: channel.snippet?.title || 'Unknown',
      channelHandle: channel.snippet?.customUrl || undefined,
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    },
    update: {
      channelId: channel.id!,
      channelName: channel.snippet?.title || 'Unknown',
      channelHandle: channel.snippet?.customUrl || undefined,
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(tokens.expiry_date!),
    },
  })
}

// ─── Get authenticated client for a user ────────────────────────────────────

async function getClientForUser(userId: string) {
  const auth = await db.youTubeAuth.findUnique({ where: { userId } })
  if (!auth) throw new Error('YouTube not connected for this user')

  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )

  client.setCredentials({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.expiresAt.getTime(),
  })

  // Auto-refresh tokens
  client.on('tokens', async (tokens) => {
    await db.youTubeAuth.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token ?? auth.accessToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : auth.expiresAt,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
      },
    })
  })

  return google.youtube({ version: 'v3', auth: client })
}

// ─── Upload video to YouTube ─────────────────────────────────────────────────

export interface UploadParams {
  userId: string
  videoPath: string
  thumbnailPath?: string
  title: string
  description: string
  tags: string[]
  visibility: 'public' | 'unlisted' | 'private'
  playlistId?: string
}

export async function uploadEpisode(params: UploadParams): Promise<{
  videoId: string
  url: string
}> {
  const youtube = await getClientForUser(params.userId)

  if (!fs.existsSync(params.videoPath)) {
    throw new Error(`Video file not found: ${params.videoPath}`)
  }

  const fileSize = fs.statSync(params.videoPath).size

  // Upload video
  const uploadRes = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: params.title,
        description: params.description,
        tags: params.tags,
        categoryId: '1', // Film & Animation
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en',
      },
      status: {
        privacyStatus: params.visibility,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(params.videoPath),
    },
  }, {
    // Resumable upload with progress
    onUploadProgress: (evt) => {
      const pct = Math.round((evt.bytesRead / fileSize) * 100)
      process.stdout.write(`\r  Uploading: ${pct}%`)
    },
  })

  const videoId = uploadRes.data.id!
  console.log(`\n  Uploaded: https://youtube.com/watch?v=${videoId}`)

  // Set thumbnail if provided
  if (params.thumbnailPath && fs.existsSync(params.thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(params.thumbnailPath),
        },
      })
      console.log('  Thumbnail set')
    } catch (err) {
      console.warn('  Thumbnail upload failed (non-fatal):', err)
    }
  }

  // Add to playlist if configured
  if (params.playlistId) {
    try {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId: params.playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      })
      console.log('  Added to playlist')
    } catch (err) {
      console.warn('  Playlist insert failed (non-fatal):', err)
    }
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  }
}

// ─── Fetch view counts for published episodes ────────────────────────────────

export async function syncViewCounts(userId: string): Promise<void> {
  const youtube = await getClientForUser(userId)

  const published = await db.episode.findMany({
    where: { userId, youtubeVideoId: { not: null } },
    select: { id: true, youtubeVideoId: true },
  })

  if (!published.length) return

  // Batch into chunks of 50 (YouTube API limit)
  for (let i = 0; i < published.length; i += 50) {
    const batch = published.slice(i, i + 50)
    const ids = batch.map((e) => e.youtubeVideoId!).join(',')

    const statsRes = await youtube.videos.list({
      part: ['statistics'],
      id: [ids],
    })

    for (const item of statsRes.data.items || []) {
      const episode = batch.find((e) => e.youtubeVideoId === item.id)
      if (!episode) continue

      await db.episode.update({
        where: { id: episode.id },
        data: {
          viewCount: parseInt(item.statistics?.viewCount || '0'),
          likeCount: parseInt(item.statistics?.likeCount || '0'),
        },
      })
    }
  }
}
