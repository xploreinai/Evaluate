'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RequireAuth } from '@/lib/useAuth'
import { sessionKey, saveSegment, saveSegmentCount } from '@/lib/recordings'

type Status = 'idle' | 'requesting' | 'recording' | 'saving' | 'stopped' | 'error'

// Browsers default to roughly 128 kbps, far more than speech needs, which would
// exhaust the upload budget in about four minutes. Opus at 24 kbps mono stays
// clear enough for transcription at roughly a fifth of the size.
const AUDIO_BITS_PER_SECOND = 24000

// Each segment is uploaded on its own and the server refuses bodies above
// 4.5 MB, so a segment is closed well before that.
const SEGMENT_LIMIT_BYTES = 3.5 * 1024 * 1024

// Browsers disagree on what MediaRecorder can produce. Pick the first supported
// type rather than assuming — Chrome gives WebM/Opus, Safari MP4.
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

const pad = (n: number) => String(n).padStart(2, '0')

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
  const [totalBytes, setTotalBytes] = useState(0)
  const [segmentCount, setSegmentCount] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Logic below runs inside recorder callbacks, where React state would be a
  // stale closure — these refs are the live values.
  const segIndexRef = useRef(0)          // next segment number to write
  const completedBytesRef = useRef(0)    // bytes already written to storage
  const rotatingRef = useRef(false)      // stopping to start a new segment?
  const finishingRef = useRef(false)     // stopping for good?

  const base = sessionKey(date, topic)

  const startSegment = useCallback(
    (stream: MediaStream) => {
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        chunksRef.current.push(e.data)

        const current = chunksRef.current.reduce((sum, c) => sum + c.size, 0)
        setTotalBytes(completedBytesRef.current + current)

        // Close this segment and open the next one. The recording continues;
        // only the file boundary moves.
        if (current >= SEGMENT_LIMIT_BYTES && !rotatingRef.current && !finishingRef.current) {
          rotatingRef.current = true
          recorder.stop()
        }
      }

      recorder.onerror = () => {
        setError('Recording stopped unexpectedly. Anything recorded so far has been saved.')
        setStatus('error')
      }

      recorder.onstop = async () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []

        try {
          if (blob.size > 0) {
            await saveSegment(base, segIndexRef.current, blob)
            segIndexRef.current += 1
            completedBytesRef.current += blob.size
            setSegmentCount(segIndexRef.current)
            setTotalBytes(completedBytesRef.current)
          }

          if (rotatingRef.current) {
            // Mid-session: immediately begin the next file.
            rotatingRef.current = false
            const live = streamRef.current
            if (live) startSegment(live)
            return
          }

          // Finished: record how many parts there are, then release the mic.
          await saveSegmentCount(base, segIndexRef.current)
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null

          if (segIndexRef.current === 0) {
            setError('No audio was captured. Check that the right microphone is selected.')
            setStatus('error')
          } else {
            setStatus('stopped')
          }
        } catch {
          setError('Could not save the recording to this device.')
          setStatus('error')
        }
      }

      // A chunk every 5s keeps the size on screen current and gives the
      // rotation check something to act on.
      recorder.start(5000)
      recorderRef.current = recorder
    },
    [base]
  )

  async function startRecording() {
    setError(null)
    setStatus('requesting')
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'This browser cannot access the microphone. Recording needs a secure (https) page and a current browser.'
        )
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // one voice, one channel — stereo would double the size
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      segIndexRef.current = 0
      completedBytesRef.current = 0
      rotatingRef.current = false
      finishingRef.current = false
      setSegmentCount(0)
      setTotalBytes(0)
      setElapsed(0)

      startSegment(stream)
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

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      finishingRef.current = true
      rotatingRef.current = false
      setStatus('saving')
      recorder.stop()
    }
  }, [])

  // Tick once per second while recording.
  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [status])

  // Stop when the planned duration is reached.
  useEffect(() => {
    if (status === 'recording' && elapsed >= totalSeconds) stopRecording()
  }, [elapsed, status, totalSeconds, stopRecording])

  // Never leave the microphone open behind us.
  useEffect(() => {
    return () => {
      const r = recorderRef.current
      if (r && r.state !== 'inactive') {
        finishingRef.current = true
        r.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function recordAgain() {
    setStatus('idle')
    setElapsed(0)
    setTotalBytes(0)
    setSegmentCount(0)
    setError(null)
    segIndexRef.current = 0
    completedBytesRef.current = 0
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
  const isRecording = status === 'recording'
  const mb = (totalBytes / 1024 / 1024).toFixed(1)

  if (!date || !topic) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Invalid session. Please go back and start again.</p>
        <button onClick={() => router.push('/')} className="text-ink font-medium">
          ← Back to start
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-surface-subtle border border-line rounded-xl p-6 mb-8">
        <p className="text-sm text-muted mb-1">Session</p>
        <h3 className="text-lg text-ink">{topic}</h3>
        <p className="text-sm text-muted mt-3">
          {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}{' '}
          • {startTime}–{endTime}
        </p>
      </div>

      <div className="bg-surface-subtle border border-line rounded-2xl p-12 text-center mb-8">
        <p className="text-muted mb-6 text-sm font-medium">
          {isRecording
            ? 'Recording in progress'
            : status === 'saving'
              ? 'Saving…'
              : status === 'stopped'
                ? 'Recording complete'
                : status === 'requesting'
                  ? 'Waiting for microphone permission…'
                  : 'Ready to record'}
        </p>
        <div className="text-7xl font-bold text-ink font-mono mb-2 tracking-tight">
          {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
        </div>
        <p className="text-muted text-sm">
          {isRecording
            ? `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)} recorded • ${mb} MB`
            : `${durationMinutes} minute limit`}
        </p>
        {isRecording && segmentCount > 0 && (
          <p className="text-xs text-muted mt-2">
            Saved in {segmentCount + 1} parts — this happens automatically on long sessions
          </p>
        )}
      </div>

      {error && (
        <div className="bg-surface-subtle border border-ink rounded-xl p-4 mb-6">
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={startRecording}
            className="btn-primary"
          >
            ● Start recording
          </button>
        )}

        {(status === 'requesting' || status === 'saving') && (
          <button
            disabled
            className="btn-primary"
          >
            {status === 'requesting' ? 'Requesting microphone…' : 'Saving recording…'}
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={stopRecording}
              className="btn-primary"
            >
              ■ Stop recording
            </button>
            <p className="text-center text-sm text-ink font-medium">Recording is live</p>
          </>
        )}

        {status === 'stopped' && (
          <>
            <button
              onClick={proceedToUpload}
              className="w-full btn-primary"
            >
              Generate quiz questions →
            </button>
            <button
              onClick={recordAgain}
              className="btn-secondary"
            >
              ↻ Record again
            </button>
          </>
        )}
      </div>

      {status === 'stopped' && totalBytes > 0 && (
        <div className="bg-sand-light border border-sand rounded-xl p-4 mb-4">
          <p className="text-sm text-ink">
            <strong>Recording saved:</strong> {mb} MB on this device
            {segmentCount > 1 && ` in ${segmentCount} parts`}
          </p>
        </div>
      )}

      <div className="bg-surface-subtle border border-line rounded-xl p-4">
        <p className="text-sm text-ink">
          Your recording is stored on this device only. Long sessions are split into parts
          automatically, so there is no limit on how long you record.
        </p>
      </div>
    </div>
  )
}

export default function RecordingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="text-center py-10">Loading…</div>}>
        <RecordingPageContent />
      </Suspense>
    </RequireAuth>
  )
}
