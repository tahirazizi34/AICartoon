// src/lib/generation-pipeline.ts
/**
 * TOONFORGE GENERATION PIPELINE — Railway edition
 * ─────────────────────────────────────────────────
 * Uses /tmp for scratch files during generation (Railway provides ephemeral /tmp).
 * Uploads finished media to S3/R2 for permanent storage.
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { db } from '@/lib/db'
import { maybeDecrypt } from '@/lib/crypto'
import { generateEpisodeScript } from '@/lib/ai/script-generator'
import { generateSceneImage, generateThumbnail } from '@/lib/ai/image-generator'
import { generateSceneVoiceovers } from '@/lib/ai/voice-generator'
import { assembleEpisode } from '@/lib/video/assembler'
import { uploadEpisode } from '@/lib/youtube/client'
import { uploadFile, storageKeys } from '@/lib/storage'
import { EpisodeStatus } from '@prisma/client'

export async function generateEpisodeForUser(userId: string): Promise<string> {
  // ── Load settings ────────────────────────────────────────────────────────
  const settings = await db.studioSettings.findUnique({ where: { userId } })
  if (!settings) throw new Error(`No settings for user ${userId}`)

  const anthropicKey  = maybeDecrypt(settings.anthropicKey)  || process.env.ANTHROPIC_API_KEY
  const replicateKey  = maybeDecrypt(settings.replicateKey)  || process.env.REPLICATE_API_TOKEN
  const elevenLabsKey = maybeDecrypt(settings.elevenLabsKey) || process.env.ELEVENLABS_API_KEY

  // ── Episode number ───────────────────────────────────────────────────────
  const last = await db.episode.findFirst({
    where: { userId },
    orderBy: { episodeNumber: 'desc' },
    select: { episodeNumber: true },
  })
  const episodeNumber = (last?.episodeNumber ?? 0) + 1

  const recentTitles = await db.episode.findMany({
    where: { userId },
    orderBy: { episodeNumber: 'desc' },
    take: 20,
    select: { title: true },
  })

  // ── Create DB record ─────────────────────────────────────────────────────
  const episode = await db.episode.create({
    data: {
      userId,
      episodeNumber,
      title: `Episode ${episodeNumber}`,
      description: '',
      script: '',
      status: EpisodeStatus.SCRIPTING,
    },
  })
  const epId = episode.id

  // Scratch directory in /tmp
  const tmpDir    = path.join(os.tmpdir(), 'toonforge', epId)
  const imagesDir = path.join(tmpDir, 'images')
  const audioDir  = path.join(tmpDir, 'audio')
  for (const d of [tmpDir, imagesDir, audioDir]) {
    fs.mkdirSync(d, { recursive: true })
  }

  const log: string[] = []
  const logStep = async (msg: string, status?: EpisodeStatus) => {
    const line = `[${new Date().toISOString()}] ${msg}`
    console.log(line)
    log.push(line)
    await db.episode.update({
      where: { id: epId },
      data: { generationLog: log.join('\n'), ...(status && { status }) },
    })
  }

  try {
    // ── 1. Script ────────────────────────────────────────────────────────────
    await logStep('Generating script...', EpisodeStatus.SCRIPTING)
    const script = await generateEpisodeScript({
      episodeNumber,
      genre: settings.genre,
      artStyle: settings.artStyle,
      characterNames: settings.characterNames.split(',').filter(Boolean),
      apiKey: anthropicKey,
      previousTitles: recentTitles.map(e => e.title),
    })
    await db.episode.update({
      where: { id: epId },
      data: { title: script.title, description: script.description, script: JSON.stringify(script) },
    })
    await logStep(`Script: "${script.title}" (${script.scenes.length} scenes)`)

    // ── 2. Voiceovers ────────────────────────────────────────────────────────
    await logStep('Generating voiceovers...', EpisodeStatus.VOICING)
    const audioPaths = await generateSceneVoiceovers({
      scenes: script.scenes,
      outputDir: audioDir,
      apiKey: elevenLabsKey,
    })
    await logStep(`${audioPaths.length} audio clips done`)

    // ── 3. Images ────────────────────────────────────────────────────────────
    await logStep('Rendering scene images...', EpisodeStatus.RENDERING)
    const imagePaths: string[] = []
    for (const scene of script.scenes) {
      const imgPath = path.join(imagesDir, `scene_${scene.id}.png`)
      await generateSceneImage({ prompt: scene.imagePrompt, outputPath: imgPath, apiKey: replicateKey })
      imagePaths.push(imgPath)
      await logStep(`  Scene ${scene.id} rendered`)
    }

    const thumbPath = path.join(tmpDir, 'thumbnail.jpg')
    await generateThumbnail({
      prompt: `${script.scenes[0].imagePrompt}, title card for "${script.title}"`,
      outputPath: thumbPath,
      apiKey: replicateKey,
    })

    // ── 4. Assemble video ────────────────────────────────────────────────────
    await logStep('Assembling video...', EpisodeStatus.ASSEMBLING)
    const videoPath = path.join(tmpDir, `episode_${episodeNumber}.mp4`)
    await assembleEpisode({
      scenes: script.scenes.map((scene, i) => ({
        imagePath: imagePaths[i],
        audioPaths: [audioPaths[i]],
        durationSeconds: scene.durationSeconds,
      })),
      outputPath: videoPath,
      tempDir: path.join(tmpDir, 'ffmpeg'),
      episodeTitle: script.title,
    })
    await logStep('Video assembled')

    // ── 5. Upload to S3/R2 ───────────────────────────────────────────────────
    await logStep('Uploading to cloud storage...')
    const videoKey = storageKeys.episodeVideo(epId, episodeNumber)
    const thumbKey = storageKeys.episodeThumbnail(epId)
    await Promise.all([
      uploadFile({ localPath: videoPath, key: videoKey, contentType: 'video/mp4' }),
      uploadFile({ localPath: thumbPath, key: thumbKey, contentType: 'image/jpeg' }),
    ])
    await db.episode.update({
      where: { id: epId },
      data: { videoPath: videoKey, thumbnailPath: thumbKey },
    })

    // ── 6. Publish to YouTube ────────────────────────────────────────────────
    if (settings.autoPublish) {
      await logStep('Uploading to YouTube...', EpisodeStatus.UPLOADING)
      const { videoId, url } = await uploadEpisode({
        userId,
        videoPath,
        thumbnailPath: thumbPath,
        title: `${script.title} | Episode ${episodeNumber}`,
        description: `${script.description}\n\n#cartoon #animation`,
        tags: script.tags,
        visibility: settings.defaultVisibility as 'public' | 'unlisted' | 'private',
        playlistId: settings.playlistId || undefined,
      })
      await db.episode.update({
        where: { id: epId },
        data: {
          status: EpisodeStatus.PUBLISHED,
          youtubeVideoId: videoId,
          youtubeUrl: url,
          publishedAt: new Date(),
          generatedAt: new Date(),
        },
      })
      await logStep(`Published: ${url}`, EpisodeStatus.PUBLISHED)
    } else {
      await db.episode.update({
        where: { id: epId },
        data: { status: EpisodeStatus.PUBLISHED, generatedAt: new Date() },
      })
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })
    return epId

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await db.episode.update({
      where: { id: epId },
      data: {
        status: EpisodeStatus.FAILED,
        errorMessage: msg,
        generationLog: [...log, `[ERROR] ${msg}`].join('\n'),
      },
    })
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    throw error
  }
}
