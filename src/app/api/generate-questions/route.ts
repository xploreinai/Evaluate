import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()

    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      )
    }

    const prompt = `You are an expert educator. Based on this training transcript, generate exactly 10 multiple-choice quiz questions that test understanding of the key concepts.

For each question, provide:
- A clear, concise question (1-2 sentences)
- Four options labeled A, B, C, D
- The correct answer (one of A, B, C, D)

Return ONLY valid JSON in this exact format:
[
  {
    "question": "What is...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct": "a"
  },
  ...
]

TRANSCRIPT:
${transcript}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error('GPT API failed')
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '[]'

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Invalid question format from AI')
    }

    const questions = JSON.parse(jsonMatch[0])

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Question generation error:', error)
    return NextResponse.json(
      { error: 'Question generation failed' },
      { status: 500 }
    )
  }
}
