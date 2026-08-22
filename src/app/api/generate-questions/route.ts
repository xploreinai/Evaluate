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

Rules:
- Each question has four options labelled a, b, c, d.
- Make 2 or 3 of the 10 questions have MORE THAN ONE correct answer, where the material genuinely supports it. For those, "correct" lists every correct letter.
- The other questions have exactly one correct answer.
- Do not write options such as "All of the above" or "Both A and B". Use a multi-answer question instead, listing the real choices.
- Base every question strictly on the transcript. Do not invent facts.

Return ONLY valid JSON — an array, with no commentary and no markdown fencing.
"correct" is ALWAYS an array, even when there is one answer:
[
  {
    "question": "What is...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct": ["a"]
  },
  {
    "question": "Which two of the following...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct": ["b", "d"]
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
    // rows that break the database insert. "correct" is normalised to an array
    // of distinct letters, whether the model returned "a" or ["a","c"].
    const LETTERS = ['a', 'b', 'c', 'd']
    const valid = (Array.isArray(questions) ? questions : [])
      .map((q) => {
        const raw = Array.isArray(q?.correct) ? q.correct : [q?.correct]
        const keys = Array.from(
          new Set(raw.map((k: unknown) => String(k).trim().toLowerCase()))
        ).filter((k) => LETTERS.includes(k as string)) as string[]
        return { ...q, correct_keys: keys }
      })
      .filter(
        (q) =>
          q?.question &&
          q?.option_a &&
          q?.option_b &&
          q?.option_c &&
          q?.option_d &&
          q.correct_keys.length >= 1 &&
          // All four being "correct" is a sign the model lost the plot.
          q.correct_keys.length < 4
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
