import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    )
  }
}
