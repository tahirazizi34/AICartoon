// src/lib/ai/voice-generator.ts
import fs from 'fs'
import path from 'path'

// ElevenLabs voice IDs — good cartoon voices
export const VOICES = {
  narrator:   'pNInz6obpgDQGcFmaJgB',  // Adam — clear, warm narrator
  energetic:  'VR6AewLTigWG4xSOukaG',  // Arnold — energetic
  friendly:   'ErXwobaYiN019PkySvjV',  // Antoni — friendly
} as const

export async function generateVoiceover(params: {
  text: string
  outputPath: string
  voiceId?: string
  apiKey?: string
}): Promise<string> {
  const apiKey = params.apiKey || process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ElevenLabs API key not configured')

  const voiceId = params.voiceId || VOICES.narrator

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: params.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`ElevenLabs error ${response.status}: ${err}`)
  }

  const dir = path.dirname(params.outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(params.outputPath, Buffer.from(buffer))

  return params.outputPath
}

// Generate per-scene audio (for fine-grained sync)
export async function generateSceneVoiceovers(params: {
  scenes: Array<{ id: number; narration: string }>
  outputDir: string
  voiceId?: string
  apiKey?: string
}): Promise<string[]> {
  const paths: string[] = []

  for (const scene of params.scenes) {
    const outputPath = path.join(params.outputDir, `scene_${scene.id}.mp3`)
    await generateVoiceover({
      text: scene.narration,
      outputPath,
      voiceId: params.voiceId,
      apiKey: params.apiKey,
    })
    paths.push(outputPath)
    // Rate limit: ElevenLabs free tier = 2 req/s
    await sleep(600)
  }

  return paths
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
