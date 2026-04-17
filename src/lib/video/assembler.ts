// src/lib/video/assembler.ts
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

export interface AssemblyScene {
  imagePath: string
  audioPaths: string[]   // per-scene audio files
  durationSeconds: number
}

/**
 * Assemble final episode video from scenes.
 * Each scene = static image + voiceover audio, concatenated together.
 * Output: 1280x720 MP4, H.264, AAC audio, YouTube-ready.
 */
export async function assembleEpisode(params: {
  scenes: AssemblyScene[]
  outputPath: string
  tempDir: string
  episodeTitle: string
}): Promise<string> {
  const { scenes, outputPath, tempDir } = params

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

  // Step 1: Build per-scene video clips (image + audio)
  const clipPaths: string[] = []
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const clipPath = path.join(tempDir, `clip_${i}.mp4`)
    await buildSceneClip(scene, clipPath)
    clipPaths.push(clipPath)
  }

  // Step 2: Concatenate all clips
  await concatenateClips(clipPaths, outputPath, tempDir)

  // Cleanup temp clips
  for (const clip of clipPaths) {
    try { fs.unlinkSync(clip) } catch {}
  }

  return outputPath
}

function buildSceneClip(scene: AssemblyScene, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Merge all scene audio files if there are multiple
    const audioInput = scene.audioPaths[0] // simplified: one audio per scene

    ffmpeg()
      .input(scene.imagePath)
      .inputOptions([
        `-loop 1`,
        `-framerate 25`,
      ])
      .input(audioInput)
      .outputOptions([
        `-c:v libx264`,
        `-tune stillimage`,
        `-c:a aac`,
        `-b:a 192k`,
        `-pix_fmt yuv420p`,
        `-shortest`,
        `-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`,
        `-movflags +faststart`,
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`FFmpeg clip error: ${err.message}`)))
      .run()
  })
}

function concatenateClips(
  clipPaths: string[],
  outputPath: string,
  tempDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Write concat manifest
    const manifest = clipPaths.map((p) => `file '${p}'`).join('\n')
    const manifestPath = path.join(tempDir, 'concat.txt')
    fs.writeFileSync(manifestPath, manifest)

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    ffmpeg()
      .input(manifestPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        `-c:v libx264`,
        `-c:a aac`,
        `-b:a 192k`,
        `-pix_fmt yuv420p`,
        `-movflags +faststart`,
        `-crf 23`,
        `-preset fast`,
      ])
      .output(outputPath)
      .on('end', () => {
        try { fs.unlinkSync(manifestPath) } catch {}
        resolve()
      })
      .on('error', (err) => reject(new Error(`FFmpeg concat error: ${err.message}`)))
      .run()
  })
}

/**
 * Add a Ken Burns (slow zoom/pan) effect to a still image clip.
 * Optional upgrade for more visual interest.
 */
export function buildKenBurnsClip(
  imagePath: string,
  audioPaths: string[],
  durationSeconds: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const zoom = `zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationSeconds * 25}:s=1280x720`

    ffmpeg()
      .input(imagePath)
      .inputOptions([`-loop 1`, `-framerate 25`])
      .input(audioPaths[0])
      .outputOptions([
        `-vf ${zoom}`,
        `-c:v libx264`,
        `-c:a aac`,
        `-b:a 192k`,
        `-t ${durationSeconds}`,
        `-pix_fmt yuv420p`,
        `-movflags +faststart`,
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Ken Burns error: ${err.message}`)))
      .run()
  })
}
