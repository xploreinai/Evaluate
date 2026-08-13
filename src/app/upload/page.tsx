'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, supabaseConfigError } from '@/lib/supabase'

// Placeholder IDs (for demo without auth)
const PLACEHOLDER_TRAINER_ID = '00000000-0000-0000-0000-000000000001'

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

  useEffect(() => {
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const topic = searchParams.get('topic')

    if (date && startTime && endTime && topic) {
      setSessionMeta({ date, startTime, endTime, topic })
      getRecordingFromIndexedDB(`session_${date}_${topic}`).then((blob) => {
        if (blob) setSizeMb(blob.size / (1024 * 1024))
      })
    }
  }, [searchParams])

  async function getRecordingFromIndexedDB(sessionKey: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('EvaluateDB', 1)

      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['recordings'], 'readonly')
        const store = transaction.objectStore('recordings')
        const getRequest = store.get(sessionKey)

        getRequest.onsuccess = () => {
          resolve(getRequest.result || null)
        }
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  }

  async function transcribeAudio(audioBlob: Blob): Promise<string> {
    setProgress('Transcribing audio...')

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

    // The server rejects request bodies over 4.5 MB before our code ever runs,
    // so catch it here where we can explain what happened.
    const sizeMb = audioBlob.size / (1024 * 1024)
    if (sizeMb > 4.2) {
      throw new Error(
        `This recording is ${sizeMb.toFixed(1)} MB, over the 4.5 MB upload limit ` +
        `(roughly 9 minutes of audio). Please record a shorter session.`
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
      const sessionKey = `session_${sessionMeta.date}_${sessionMeta.topic}`
      const audioBlob = await getRecordingFromIndexedDB(sessionKey)

      if (!audioBlob) {
        throw new Error('No recording found. Please record audio first.')
      }

      // Step 2: Transcribe audio using Whisper
      const transcript = await transcribeAudio(audioBlob)

      // Step 3: Generate questions using GPT-4
      const questions = await generateQuestions(transcript)

      if (questions.length === 0) {
        throw new Error('Failed to generate questions')
      }

      // Step 4: Create session in Supabase (NO recording file)
      if (supabaseConfigError) throw new Error(supabaseConfigError)
      setProgress('Saving session...')
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          trainer_id: PLACEHOLDER_TRAINER_ID,
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
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Process your recording
      </h2>
      <p className="text-gray-500 mb-8">
        {sessionMeta.topic} • {new Date(sessionMeta.date).toLocaleDateString()} • {sessionMeta.startTime}–{sessionMeta.endTime}
      </p>

      <form onSubmit={handleProcess} className="space-y-6">
        {/* Status message */}
        {status === 'processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <div className="animate-spin inline-block mb-3">⚙️</div>
            <p className="font-semibold text-blue-900 mb-1">Processing...</p>
            <p className="text-sm text-blue-600">{progress}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-600">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Info box */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <p className="text-green-900">
            ✓ <strong>Recording found</strong> on your device ({sessionMeta.topic})
            {sizeMb !== null && ` — ${sizeMb.toFixed(1)} MB`}
          </p>
          {sizeMb !== null && sizeMb > 4.2 && (
            <p className="text-sm text-red-700 mt-2">
              This exceeds the 4.5 MB upload limit. Please record a shorter session.
            </p>
          )}
          <p className="text-sm text-green-700 mt-2">
            Your recording will be transcribed and AI will generate 10 quiz questions based on the content.
          </p>
        </div>

        {/* Process button */}
        <button
          type="submit"
          disabled={status === 'processing'}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-base"
        >
          {status === 'processing' ? 'Processing...' : '🚀 Generate Quiz Questions'}
        </button>
      </form>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  )
}
