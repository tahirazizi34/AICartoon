// src/lib/storage.ts
/**
 * Cloud storage abstraction.
 * Works with AWS S3 or Cloudflare R2 (R2 is S3-compatible and has free egress).
 *
 * Set in Railway env vars:
 *   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *   S3_ENDPOINT  (only for R2: https://<account>.r2.cloudflarestorage.com)
 *   S3_PUBLIC_URL (public base URL for serving media, e.g. https://media.yourdomain.com)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

function getClient() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT, // set for R2, omit for AWS
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })
}

const BUCKET = process.env.S3_BUCKET!

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(params: {
  localPath: string
  key: string          // S3 key, e.g. "episodes/abc123/video.mp4"
  contentType: string
}): Promise<string> {
  const client = getClient()
  const body = fs.readFileSync(params.localPath)

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    Body: body,
    ContentType: params.contentType,
  }))

  return getPublicUrl(params.key)
}

export async function uploadBuffer(params: {
  buffer: Buffer
  key: string
  contentType: string
}): Promise<string> {
  const client = getClient()

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
  }))

  return getPublicUrl(params.key)
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function downloadToTemp(params: {
  key: string
  localPath: string
}): Promise<string> {
  const client = getClient()
  const dir = path.dirname(params.localPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const res = await client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
  }))

  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(params.localPath)
    ;(res.Body as Readable).pipe(writeStream)
    writeStream.on('finish', () => resolve(params.localPath))
    writeStream.on('error', reject)
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// ── Signed URL (for private buckets) ─────────────────────────────────────────

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

// ── Public URL ────────────────────────────────────────────────────────────────

export function getPublicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_URL
  if (base) return `${base.replace(/\/$/, '')}/${key}`
  // Fallback: standard S3 URL
  return `https://${BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`
}

// ── S3 keys convention ────────────────────────────────────────────────────────

export const storageKeys = {
  episodeVideo:     (epId: string, epNum: number) => `episodes/${epId}/episode_${epNum}.mp4`,
  episodeThumbnail: (epId: string)                => `thumbnails/${epId}.jpg`,
  sceneImage:       (epId: string, sceneId: number) => `temp/${epId}/scene_${sceneId}.png`,
  sceneAudio:       (epId: string, sceneId: number) => `temp/${epId}/scene_${sceneId}.mp3`,
}
