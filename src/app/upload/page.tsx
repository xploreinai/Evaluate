'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, supabaseConfigError } from '@/lib/supabase'
import { RequireAuth } from '@/lib/useAuth'
import { sessionKey, loadSegments } from '@/lib/recordings'


// Supabase rejects a query with a plain object ({ message, details, hint, code }),
// not an Error — so `err.message` alone silently loses the reason.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const parts = [e.message, e.details, e.hint].filter(Boolean).join(' — ')
    if (parts) return e.code ? `${parts} (code ${e.code})` : parts
    return JSON.stringify(err)
  }
  return String(err) || 'Something went wrong.'
}

function UploadPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sessionMeta, setSessionMeta] = useState<{
    date: string
    startTime: string
    endTime: string
    topic: string
  } | null>(null)

  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')

  const [sizeMb, setSizeMb] = useState<number | null>(null)
  const [partCount, setPartCount] = useState(0)

  useEffect(() => {
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const topic = searchParams.get('topic')

    if (date && startTime && endTime && topic) {
      setSessionMeta({ date, startTime, endTime, topic })
      loadSegments(sessionKey(date, topic)).then((segments) => {
        if (segments.length) {
          setSizeMb(segments.reduce((sum, b) => sum + b.size, 0) / (1024 * 1024))
          setPartCount(segments.length)
        }
      })
    }
  }, [searchParams])

  // Each part is sent as its own request — one long upload would exceed the
  // server's 4.5 MB body limit and its 60-second time limit.
  async function transcribeAll(segments: Blob[]): Promise<string> {
    const parts: string[] = []
    for (let i = 0; i < segments.length; i++) {
      setProgress(
        segments.length > 1
          ? `Transcribing part ${i + 1} of ${segments.length}…`
          : 'Transcribing audio…'
      )
      parts.push(await transcribeSegment(segments[i]))
    }
    // Joined with blank lines so the model sees the parts as continuous speech.
    return parts.filter((p) => p.trim()).join('\n\n')
  }

  async function transcribeSegment(audioBlob: Blob): Promise<string> {
    // Whisper identifies the audio format from the filename extension, so it
    // has to match what the browser actually recorded (usually WebM/Opus).
    const type = audioBlob.type || 'audio/webm'
    const ext = type.includes('mp4')
      ? 'mp4'
      : type.includes('ogg')
        ? 'ogg'
        : type.includes('wav')
          ? 'wav'
          : 'webm'

    // Segments are closed at 3.5 MB, so this should never fire — it guards
    // against recordings made before segmentation existed.
    const partMb = audioBlob.size / (1024 * 1024)
    if (partMb > 4.2) {
      throw new Error(
        `This recording is ${partMb.toFixed(1)} MB, over the 4.5 MB upload limit. ` +
        `Please record it again — long sessions are now split automatically.`
      )
    }

    const formData = new FormData()
    formData.append('audio', audioBlob, `recording.${ext}`)

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      // A timeout or size rejection returns an HTML error page, not JSON —
      // fall back to the status so the real cause stays visible.
      const text = await response.text().catch(() => '')
      let message = `Transcription failed (HTTP ${response.status})`
      try {
        const parsed = JSON.parse(text)
        if (parsed.error) message = parsed.error
      } catch {
        if (response.status === 413) {
          message = 'Recording is too large to upload. Please record a shorter session.'
        } else if (response.status === 504) {
          message = 'Transcription timed out. Please try a shorter recording.'
        }
      }
      throw new Error(message)
    }

    const data = await response.json()
    return data.transcript
  }

  async function generateQuestions(transcript: string): Promise<any[]> {
    setProgress('Generating quiz questions...')

    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let message = `Question generation failed (HTTP ${response.status})`
      try {
        const parsed = JSON.parse(text)
        if (parsed.error) message = parsed.error
      } catch {
        /* non-JSON error page; keep the status message */
      }
      throw new Error(message)
    }

    const data = await response.json()
    return data.questions
  }

  async function handleProcess(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionMeta) return

    setStatus('processing')
    setError(null)

    try {
      // Step 1: Get recording from IndexedDB
      setProgress('Retrieving recording...')
      const segments = await loadSegments(sessionKey(sessionMeta.date, sessionMeta.topic))

      if (segments.length === 0) {
        throw new Error('No recording found. Please record audio first.')
      }

      // Step 2: Transcribe every part and join the text
      const transcript = await transcribeAll(segments)

      if (!transcript.trim()) {
        throw new Error('No speech was detected in the recording. Please record again.')
      }

      // Step 3: Generate questions using GPT-4
      const questions = await generateQuestions(transcript)

      if (questions.length === 0) {
        throw new Error('Failed to generate questions')
      }

      // Step 4: Create session in Supabase (NO recording file)
      if (supabaseConfigError) throw new Error(supabaseConfigError)
      setProgress('Saving session...')

      // The row is owned by the signed-in trainer; the security policies
      // require trainer_id to match the authenticated user.
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          trainer_id: auth.user.id,
          topic: sessionMeta.topic.trim(),
          session_date: sessionMeta.date,
          start_time: sessionMeta.startTime,
          end_time: sessionMeta.endTime,
          status: 'draft',
        })
        .select()
        .single()

      if (sessionError) throw new Error(`Saving the session failed: ${describeError(sessionError)}`)

      // Step 5: Insert questions into Supabase
      setProgress('Saving questions...')
      const questionsToInsert = questions.map((q) => ({
        session_id: session.id,
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct: q.correct.toLowerCase(),
      }))

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToInsert)

      if (questionsError) throw new Error(`Saving the questions failed: ${describeError(questionsError)}`)

      // Step 6: Navigate to review page
      setProgress('Complete! Redirecting...')
      setTimeout(() => {
        router.push(`/session/${session.id}/review`)
      }, 1000)

    } catch (err: unknown) {
      console.error('Processing failed:', err)
      setError(describeError(err))
      setStatus('error')
    }
  }

  if (!sessionMeta) {
    return <div className="text-center py-10">Loading...</div>
  }

  return (
    <div>
      {/* Page heading */}
      <h2 className="text-2xl text-ink mb-1">
        Process your recording
      </h2>
      <p className="text-muted mb-8">
        {sessionMeta.topic} • {new Date(sessionMeta.date).toLocaleDateString()} • {sessionMeta.startTime}–{sessionMeta.endTime}
      </p>

      <form onSubmit={handleProcess} className="space-y-6">
        {/* Status message */}
        {status === 'processing' && (
          <div className="bg-surface-subtle border border-line rounded-xl p-6 text-center">
            <div className="animate-spin inline-block mb-3">⚙️</div>
            <p className="font-semibold text-ink mb-1">Processing...</p>
            <p className="text-sm text-ink">{progress}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-surface-subtle border border-ink rounded-xl p-4">
            <p className="text-sm text-ink">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Info box */}
        <div className="bg-sand-light border border-sand rounded-xl p-6">
          <p className="text-ink">
            ✓ <strong>Recording found</strong> on your device ({sessionMeta.topic})
            {sizeMb !== null && ` — ${sizeMb.toFixed(1)} MB`}
            {partCount > 1 && ` in ${partCount} parts`}
          </p>
          <p className="text-sm text-muted mt-2">
            Your recording will be transcribed and AI will generate 10 quiz questions based on the content.
          </p>
        </div>

        {/* Process button */}
        <button
          type="submit"
          disabled={status === 'processing'}
          className="w-full btn-primary"
        >
          {status === 'processing' ? 'Processing...' : '🚀 Generate Quiz Questions'}
        </button>
      </form>
    </div>
  )
}

function UploadPageInner() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  )
}


export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadPageInner />
    </RequireAuth>
  )
}
