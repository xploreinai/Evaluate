// Groq retires models on its own schedule, and a hard-coded name eventually
// starts returning "model does not exist". Rather than pin one, ask Groq what
// it currently serves and take the best available from a preference list.

const MODELS_URL = 'https://api.groq.com/openai/v1/models'

// Best first. Anything unavailable is skipped.
const CHAT_PREFERENCE = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
]

const AUDIO_PREFERENCE = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
  'distil-whisper-large-v3-en',
]

const isAudio = (id: string) => /whisper/i.test(id)
const isChat = (id: string) => !/whisper|tts|guard|embed|moderation/i.test(id)

// Cached for the lifetime of the serverless instance so a burst of requests
// does not re-list models every time.
let cache: { chat?: string; audio?: string; at: number } = { at: 0 }
const CACHE_MS = 10 * 60 * 1000

async function listModels(apiKey: string): Promise<string[] | null> {
  try {
    const res = await fetch(MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) return null
    const body = await res.json()
    return Array.isArray(body?.data) ? body.data.map((m: { id: string }) => m.id) : null
  } catch {
    return null
  }
}

export async function resolveModel(apiKey: string, kind: 'chat' | 'audio'): Promise<string> {
  const preference = kind === 'chat' ? CHAT_PREFERENCE : AUDIO_PREFERENCE

  const fresh = Date.now() - cache.at < CACHE_MS
  const cached = kind === 'chat' ? cache.chat : cache.audio
  if (fresh && cached) return cached

  const ids = await listModels(apiKey)

  // If the catalogue cannot be read, fall back to the first preference and let
  // the actual request report any problem.
  let chosen = preference[0]
  if (ids?.length) {
    const available = new Set(ids)
    chosen =
      preference.find((m) => available.has(m)) ??
      ids.find(kind === 'chat' ? isChat : isAudio) ??
      preference[0]
  }

  cache = { ...cache, [kind]: chosen, at: Date.now() }
  return chosen
}
