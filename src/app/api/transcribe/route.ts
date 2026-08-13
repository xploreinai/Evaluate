import { NextRequest, NextResponse } from 'next/server'

// Whisper on a multi-minute recording takes far longer than the 10s default
// this plan gives a function. 60s is the Hobby maximum.
export const maxDuration = 60
export const runtime = 'nodejs'

// An API key pasted from a masked field carries bullet characters, which
// cannot go into an HTTP header. Fail with a message that says so.
function apiKeyProblem(key: string | undefined): string | null {
  if (!key) return 'OPENAI_API_KEY is not set on the server.'
  if (!/^[\x20-\x7E]+$/.test(key)) {
    return 'OPENAI_API_KEY contains invalid characters — it looks like a masked key was copied instead of the real one. Re-copy it from the OpenAI dashboard.'
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    const keyProblem = apiKeyProblem(apiKey)
    if (keyProblem) {
      console.error('API key problem:', keyProblem)
      return NextResponse.json({ error: keyProblem }, { status: 500 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio provided' },
        { status: 400 }
      )
    }

    // Preserve the client's filename — Whisper reads the extension to decide
    // how to decode the audio, so renaming it to .wav breaks the request.
    const whisperFormData = new FormData()
    whisperFormData.append('file', audioFile, audioFile.name || 'recording.webm')
    whisperFormData.append('model', 'whisper-1')

    const whisperResponse = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperFormData,
      }
    )

    if (!whisperResponse.ok) {
      const detail = await whisperResponse.text()
      console.error('Whisper API error:', whisperResponse.status, detail)
      return NextResponse.json(
        { error: `Transcription failed (${whisperResponse.status}): ${detail.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const { text: transcript } = await whisperResponse.json()

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('Transcription error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Transcription failed: ${detail}` },
      { status: 500 }
    )
  }
}
