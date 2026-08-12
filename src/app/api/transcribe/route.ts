import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioBlob = formData.get('audio') as Blob

    if (!audioBlob) {
      return NextResponse.json(
        { error: 'No audio provided' },
        { status: 400 }
      )
    }

    // Call Whisper API
    const whisperFormData = new FormData()
    whisperFormData.append('file', audioBlob, 'recording.wav')
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
      throw new Error('Whisper API failed')
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
