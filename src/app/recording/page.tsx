'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Status = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

// Browsers disagree on what MediaRecorder can produce. Pick the first
// supported type rather than assuming — Chrome gives WebM/Opus, Safari MP4.
function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  if (typeof MediaRecorder === 'undefined') return undefined
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

function RecordingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''
  const topic = searchParams.get('topic') || ''
  const durationMinutes = parseInt(searchParams.get('duration') || '20', 10)
  const totalSeconds = durationMinutes * 60

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [recordingSize, setRecordingSize] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const saveRecording = useCallback(
    (blob: Blob) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('EvaluateDB', 1)
        request.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('recordings')) {
            db.createObjectStore('recordings')
          }
        }
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['recordings'], 'readwrite')
          tx.objectStore('recordings').put(blob, `session_${date}_${topic}`)
          // Resolve on transaction completion, not on put() — otherwise the
          // next page can read before the write has actually landed.
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        request.onerror = () => reject(request.error)
      }),
    [date, topic]
  )

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  async function startRecording() {
    setError(null)
    setStatus('requesting')
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'This browser cannot access the microphone. Recording needs a secure (https) page and a current browser.'
        )
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onerror = () => {
        setError('Recording stopped unexpectedly. Please try again.')
        setStatus('error')
      }

      recorder.onstop = async () => {
        // Keep the real MIME type: the file extension derived from it is how
        // the transcription API identifies the audio format.
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        if (blob.size === 0) {
          setError('No audio was captured. Check that the right microphone is selected.')
          setStatus('error')
          return
        }

        try {
          await saveRecording(blob)
          setRecordingSize(Math.round(blob.size / 1024))
          setStatus('stopped')
        } catch {
          setError('Could not save the recording to this device.')
          setStatus('error')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setElapsed(0)
      setStatus('recording')
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ''
      let message = err instanceof Error ? err.message : 'Could not start recording.'
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        message =
          'Microphone access was blocked. Click the padlock icon in the address bar, allow the microphone, then try again.'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = 'No microphone was found on this device.'
      } else if (name === 'NotReadableError') {
        message = 'The microphone is already in use by another app.'
      }
      setError(message)
      setStatus('error')
    }
  }

  // Tick once per second while recording.
  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [status])

  // Auto-stop when the planned duration is reached.
  useEffect(() => {
    if (status === 'recording' && elapsed >= totalSeconds) {
      stopRecording()
    }
  }, [elapsed, status, totalSeconds, stopRecording])

  // Never leave the microphone open behind us.
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.state !== 'inactive' && mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function recordAgain() {
    setStatus('idle')
    setElapsed(0)
    setRecordingSize(0)
    setError(null)
    chunksRef.current = []
  }

  function proceedToUpload() {
    const params = new URLSearchParams({
      date,
      startTime,
      endTime,
      topic,
      duration: String(durationMinutes),
    })
    router.push(`/upload?${params.toString()}`)
  }

  const remaining = Math.max(0, totalSeconds - elapsed)
  const mm = pad(Math.floor(remaining / 60))
  const ss = pad(remaining % 60)
  const isRecording = status === 'recording'

  if (!date || !topic) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 mb-4">Invalid session. Please go back and start again.</p>
        <button onClick={() => router.push('/')} className="text-blue-600 font-medium">
          ← Back to start
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <p className="text-sm text-gray-500 mb-1">Session</p>
        <h3 className="text-lg font-semibold text-gray-900">{topic}</h3>
        <p className="text-sm text-gray-600 mt-3">
          {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}{' '}
          • {startTime}–{endTime}
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-12 text-center mb-8">
        <p className="text-gray-600 mb-6 text-sm font-medium">
          {isRecording
            ? 'Recording in progress'
            : status === 'stopped'
              ? 'Recording complete'
              : status === 'requesting'
                ? 'Waiting for microphone permission…'
                : 'Ready to record'}
        </p>
        <div className="text-7xl font-bold text-gray-900 font-mono mb-2 tracking-tight">
          {mm}:{ss}
        </div>
        <p className="text-gray-600 text-sm">
          {isRecording
            ? `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)} recorded`
            : `${durationMinutes} minute limit`}
        </p>
        {status === 'stopped' && remaining === 0 && (
          <p className="text-blue-600 font-semibold mt-4">Time is up</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={startRecording}
            className="w-full bg-red-600 text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 transition-colors text-base"
          >
            ● Start recording
          </button>
        )}

        {status === 'requesting' && (
          <button
            disabled
            className="w-full bg-gray-400 text-white font-semibold py-3.5 rounded-xl text-base"
          >
            Requesting microphone…
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={stopRecording}
              className="w-full bg-red-600 text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 transition-colors text-base"
            >
              ■ Stop recording
            </button>
            <p className="text-center text-sm text-red-600 font-medium">Recording is live</p>
          </>
        )}

        {status === 'stopped' && (
          <>
            <button
              onClick={proceedToUpload}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base"
            >
              Generate quiz questions →
            </button>
            <button
              onClick={recordAgain}
              className="w-full border border-gray-300 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-base"
            >
              ↻ Record again
            </button>
          </>
        )}
      </div>

      {recordingSize > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-900">
            <strong>Recording saved:</strong> {recordingSize} KB stored on this device
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          Your recording is stored on this device only. Your browser will ask for microphone
          permission the first time you press start.
        </p>
      </div>
    </div>
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function RecordingPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading…</div>}>
      <RecordingPageContent />
    </Suspense>
  )
}
