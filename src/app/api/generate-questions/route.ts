import { NextRequest, NextResponse } from 'next/server'

// Groq exposes an OpenAI-compatible chat endpoint.
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set on the server.' }, { status: 500 })
    }
    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      return NextResponse.json(
        {
          error:
            'GROQ_API_KEY contains invalid characters — it looks like a masked key was copied instead of the real one. Re-copy it from the Groq console.',
        },
        { status: 500 }
      )
    }

    const { transcript } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    const prompt = `You are an expert educator. Based on this training transcript, generate exactly 10 multiple-choice quiz questions that test understanding of the key concepts.

For each question, provide:
- A clear, concise question (1-2 sentences)
- Four options labeled A, B, C, D
- The correct answer (one of A, B, C, D)

Return ONLY valid JSON — an array, with no commentary and no markdown fencing:
[
  {
    "question": "What is...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct": "a"
  }
]

TRANSCRIPT:
${transcript}`

    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Question generation API error:', response.status, detail)
      return NextResponse.json(
        { error: `Question generation failed (${response.status}): ${detail.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '[]'

    // Models sometimes wrap JSON in prose or code fences; pull out the array.
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Unparseable model output:', content.slice(0, 500))
      return NextResponse.json(
        { error: 'The AI returned an unexpected format. Please try again.' },
        { status: 502 }
      )
    }

    let questions
    try {
      questions = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Invalid JSON from model:', jsonMatch[0].slice(0, 500))
      return NextResponse.json(
        { error: 'The AI returned invalid JSON. Please try again.' },
        { status: 502 }
      )
    }

    // Keep only well-formed questions so a partial response cannot produce
    // rows that break the database insert.
    const valid = (Array.isArray(questions) ? questions : []).filter(
      (q) =>
        q?.question &&
        q?.option_a &&
        q?.option_b &&
        q?.option_c &&
        q?.option_d &&
        ['a', 'b', 'c', 'd'].includes(String(q?.correct).toLowerCase())
    )

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'No usable questions were generated. The recording may be too short.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ questions: valid })
  } catch (error) {
    console.error('Question generation error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Question generation failed: ${detail}` }, { status: 500 })
  }
}
