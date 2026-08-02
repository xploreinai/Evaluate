'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Placeholder org + trainer IDs ───────────────────────────────────────────
const PLACEHOLDER_ORG_ID = '00000000-0000-0000-0000-000000000001'
const PLACEHOLDER_TRAINER_ID = '00000000-0000-0000-0000-000000000001'

export default function UploadPage() {
  const searchParams = useSearchParams()
  const [sessionMeta, setSessionMeta] = useState<{
    date: string
    startTime: string
    endTime: string
    topic: string
  } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const topic = searchParams.get('topic')

    if (date && startTime && endTime && topic) {
      setSessionMeta({ date, startTime, endTime, topic })
    }
  }, [searchParams])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !sessionMeta) return

    setStatus('uploading')
    setError(null)

    try {
      // Step 1 — Create the session row in the database
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          org_id: PLACEHOLDER_ORG_ID,
          trainer_id: PLACEHOLDER_TRAINER_ID,
          title: sessionMeta.topic.trim(),
          department: null,
          session_date: sessionMeta.date,
          status: 'processing',
          pass_threshold: 70,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Step 2 — Upload the recording directly to Supabase Storage
      const ext = file.name.split('.').pop() ?? 'mp4'
      const storagePath = `${session.id}/recording.${ext}`

      const { error: storageError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, file, { upsert: false })

      if (storageError) throw storageError

      // Step 3 — Save the storage path back to the session row
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ recording_url: storagePath })
        .eq('id', session.id)

      if (updateError) throw updateError

      // Step 4 — Trigger the Edge Function that runs Whisper + GPT-4o
      await supabase.functions.invoke('process-session', {
        body: { session_id: session.id },
      })

      // Step 5 — Go to the review screen
      window.location.href = `/session/${session.id}/review`

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
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
        Upload your recording
      </h2>
      <p className="text-gray-500 mb-8">
        {sessionMeta.topic} • {new Date(sessionMeta.date).toLocaleDateString()} • {sessionMeta.startTime}–{sessionMeta.endTime}
      </p>

      <form onSubmit={handleUpload} className="space-y-6">

        {/* File drop zone */}
        <Field label="Recording file" required>
          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl px-6 py-10 cursor-pointer hover:border-blue-400 transition-colors text-center"
          >
            {file ? (
              <>
                <span className="text-2xl mb-2">🎙️</span>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
                </p>
              </>
            ) : (
              <>
                <span className="text-3xl mb-3">☁️</span>
                <p className="text-gray-600">
                  Drop your recording here or{' '}
                  <span className="text-blue-600 font-medium">browse</span>
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Audio or video · MP3, MP4, M4A, WAV · up to 60 min
                </p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              accept="audio/*,video/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
              className="hidden"
            />
          </label>
        </Field>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-base"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={status === 'uploading' || !file}
            className="flex-1 bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload and generate quiz →'}
          </button>
        </div>

      </form>
    </div>
  )
}

// ─── Small helper components ──────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'focus:border-transparent transition'
