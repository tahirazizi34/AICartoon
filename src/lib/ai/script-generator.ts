// src/lib/ai/script-generator.ts
import Anthropic from '@anthropic-ai/sdk'

export interface EpisodeScript {
  title: string
  description: string        // YouTube description (max 5000 chars)
  tags: string[]
  scenes: Scene[]
  fullNarration: string      // flat text for TTS
}

export interface Scene {
  id: number
  imagePrompt: string        // for Stable Diffusion
  narration: string          // spoken audio for this scene
  durationSeconds: number    // how long to hold this scene
}

export async function generateEpisodeScript(params: {
  episodeNumber: number
  genre: string
  artStyle: string
  characterNames: string[]
  apiKey?: string
  previousTitles?: string[]
}): Promise<EpisodeScript> {
  const client = new Anthropic({
    apiKey: params.apiKey || process.env.ANTHROPIC_API_KEY,
  })

  const previousContext = params.previousTitles?.length
    ? `\nAvoid repeating these recent episode titles: ${params.previousTitles.join(', ')}`
    : ''

  const charactersContext = params.characterNames.length
    ? `\nRecurring characters to include: ${params.characterNames.join(', ')}`
    : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a cartoon episode writer for a ${params.genre} animated series in ${params.artStyle} style.

Generate Episode ${params.episodeNumber} as a complete JSON object.${charactersContext}${previousContext}

Return ONLY valid JSON, no markdown, no explanation:

{
  "title": "Episode title (creative, 4-8 words)",
  "description": "YouTube description (2-3 sentences, engaging, includes episode number)",
  "tags": ["array", "of", "10", "youtube", "tags"],
  "scenes": [
    {
      "id": 1,
      "imagePrompt": "Detailed image generation prompt for this scene. Include art style, lighting, characters, setting. Be specific. 30-60 words.",
      "narration": "What the narrator or character says during this scene. 2-4 sentences.",
      "durationSeconds": 12
    }
  ],
  "fullNarration": "All narration text concatenated in order, for TTS. Should be 60-120 seconds of speech at normal pace."
}

Requirements:
- 6-8 scenes total
- Each scene 10-18 seconds
- Total episode 90-120 seconds
- Image prompts must specify: "${params.artStyle} style, vibrant colors, cartoon, high quality"
- Make it fun, age-appropriate, episodic (complete story arc)`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip any accidental markdown fences
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const script = JSON.parse(clean) as EpisodeScript
    // Validate required fields
    if (!script.title || !script.scenes?.length) {
      throw new Error('Invalid script structure')
    }
    return script
  } catch (err) {
    throw new Error(`Script parse failed: ${err}. Raw: ${clean.slice(0, 200)}`)
  }
}
