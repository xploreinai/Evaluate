'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function RecordingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''
  const topic = searchParams.get('topic') || ''
  const durationMinutes = parseInt(searchParams.get('duration') || '20')

  const [isRecording, setIsRecording] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60)
  const [hasRecorded, setHasRecorded] = useState(false)
  const [recordingSize, setRecordingSize] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Initialize recording
  useEffect(() => {
    async function initRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data)
        }

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          setRecordingSize(Math.round(audioBlob.size / 1024)) // KB
          await saveRecordingToIndexedDB(audioBlob)
          audioChunksRef.current = []
        }
      } catch (err) {
        console.error('Microphone access denied:', err)
      }
    }

    initRecording()
  }, [])

  // Save recording to IndexedDB
  async function saveRecordingToIndexedDB(blob: Blob) {
    return new Promise((resolve) => {
      const request = indexedDB.open('EvaluateDB', 1)

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings')
        }
      }

      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['recordings'], 'readwrite')
        const store = transaction.objectStore('recordings')
        const sessionKey = `session_${date}_${topic}`
        store.put(blob, sessionKey)
        resolve(null)
      }
    })
  }

  useEffect(() => {
    if (!isRecording || secondsRemaining <= 0) return

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          stopRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording, secondsRemaining])

  async function startRecording() {
    if (mediaRecorderRef.current) {
      audioChunksRef.current = []
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setHasRecorded(true)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  function resetTimer() {
    stopRecording()
    setSecondsRemaining(durationMinutes * 60)
    setHasRecorded(false)
    setRecordingSize(0)
    audioChunksRef.current = []
  }

  function proceedToUpload() {
    const params = new URLSearchParams({
      date,
      startTime,
      endTime,
      topic,
      duration: durationMinutes.toString(),
    })
    router.push(`/upload?${params.toString()}`)
  }

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  const isTimeUp = secondsRemaining === 0

  if (!date || !topic) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">Invalid session. Please go back and start again.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Session info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <p className="text-sm text-gray-500 mb-1">Session</p>
        <h3 className="text-lg font-semibold text-gray-900">{topic}</h3>
        <p className="text-sm text-gray-600 mt-3">
          {new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })} • {startTime}–{endTime}
        </p>
      </div>

      {/* Timer display */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-12 text-center mb-8">
        <p className="text-gray-600 mb-6 text-sm font-medium">
          {isRecording ? 'Recording in progress' : 'Ready to record'}
        </p>
        <div className="text-7xl font-bold text-gray-900 font-mono mb-2 tracking-tight">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <p className="text-gray-600 text-sm">
          {isRecording ? 'Timer counting down' : 'Press start when ready'}
        </p>

        {isTimeUp && hasRecorded && (
          <p className="text-blue-600 font-semibold mt-4">✓ Time is up!</p>
        )}
      </div>

      {/* Control buttons */}
      <div className="space-y-3 mb-8">
        {!isRecording && !hasRecorded && (
          <button
            onClick={startRecording}
            className="w-full bg-red-600 text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 transition-colors text-base"
          >
            🔴 Start recording
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={stopRecording}
              className="w-full bg-red-600 text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 transition-colors text-base"
            >
              ⏹ Stop recording
            </button>
            <p className="text-center text-sm text-red-600 font-medium">
              Recording is live
            </p>
          </>
        )}

        {hasRecorded && !isRecording && (
          <>
            <button
              onClick={resetTimer}
              className="w-full border border-gray-300 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-base"
            >
              ↻ Record again
            </button>
            <button
              onClick={proceedToUpload}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base"
            >
              Upload recording →
            </button>
          </>
        )}
      </div>

      {/* Recording info */}
      {recordingSize > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-900">
            ✓ <strong>Recording saved:</strong> {recordingSize} KB stored on your device
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Tip:</strong> Your recording is stored securely on this device. Click "Upload" to generate quiz questions from your training audio.
        </p>
      </div>
    </div>
  )
}
