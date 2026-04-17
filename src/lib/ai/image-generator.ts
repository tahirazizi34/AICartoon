// src/lib/ai/image-generator.ts
import Replicate from 'replicate'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const SDXL_MODEL = 'stability-ai/sdxl:39ed52f2319f9312616c3e1a9aa0ea60564e4e8a5ff80578f5d42d0ee282a1e4'

export async function generateSceneImage(params: {
  prompt: string
  negativePrompt?: string
  outputPath: string
  apiKey?: string
}): Promise<string> {
  const replicate = new Replicate({
    auth: params.apiKey || process.env.REPLICATE_API_TOKEN,
  })

  const negative = params.negativePrompt ||
    'blurry, low quality, deformed, ugly, bad anatomy, watermark, text, nsfw'

  const output = await replicate.run(SDXL_MODEL as `${string}/${string}:${string}`, {
    input: {
      prompt: params.prompt,
      negative_prompt: negative,
      width: 1280,
      height: 720,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      num_outputs: 1,
    },
  }) as string[]

  const imageUrl = Array.isArray(output) ? output[0] : output
  if (!imageUrl) throw new Error('No image URL returned from Replicate')

  // Download image to disk
  await downloadFile(imageUrl, params.outputPath)
  return params.outputPath
}

export async function generateThumbnail(params: {
  prompt: string
  outputPath: string
  apiKey?: string
}): Promise<string> {
  // Thumbnail is 1280x720 with a more dramatic/title-card prompt
  return generateSceneImage({
    prompt: `${params.prompt}, dramatic lighting, title card composition, bold colors, cartoon style`,
    outputPath: params.outputPath,
    apiKey: params.apiKey,
  })
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http

    protocol.get(url, (response) => {
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}
