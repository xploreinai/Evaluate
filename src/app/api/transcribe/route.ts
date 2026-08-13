import { NextRequest, NextResponse } from 'next/server'

// Groq exposes an OpenAI-compatible API, so the request shape below is the
// same one OpenAI uses — only the host, model and key differ.
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_TRANSCRIBE_MODEL = 'whisper-large-v3-turbo'

// Transcription of a multi-minute recording takes far longer than the 10s
// default a function gets. 60s is the Hobby maximum.
export const maxDuration = 60
export const runtime = 'nodejs'

// A key pasted from a masked field carries bullet characters, which cannot go
// into an HTTP header. Fail with a message that says so.
function apiKeyProblem(key: string | undefined): string | null {
  if (!key) return 'GROQ_API_KEY is not set on the server.'
  if (!/^[\x20-\x7E]+$/.test(key)) {
    return 'GROQ_API_KEY contains invalid characters — it looks like a masked key was copied instead of the real one. Re-copy it from the Groq console.'
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    const keyProblem = apiKeyProblem(apiKey)
    if (keyProblem) {
      console.error('API key problem:', keyProblem)
      return NextResponse.json({ error: keyProblem }, { status: 500 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    // Preserve the client's filename — the API reads the extension to decide
    // how to decode the audio, so renaming it breaks the request.
    const upstreamForm = new FormData()
    upstreamForm.append('file', audioFile, audioFile.name || 'recording.webm')
    upstreamForm.append('model', GROQ_TRANSCRIBE_MODEL)
    upstreamForm.append('response_format', 'json')

    const response = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Transcription API error:', response.status, detail)
      return NextResponse.json(
        { error: `Transcription failed (${response.status}): ${detail.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const { text: transcript } = await response.json()

    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: 'No speech was detected in the recording. Please record again and speak clearly.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('Transcription error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Transcription failed: ${detail}` }, { status: 500 })
  }
}
