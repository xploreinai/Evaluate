'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [date, setDate] = useState(today())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState('20')

  function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !startTime || !endTime || !topic || !duration) return

    // Encode session metadata in URL params for the recording page
    const params = new URLSearchParams({
      date,
      startTime,
      endTime,
      topic,
      duration,
    })

    router.push(`/recording?${params.toString()}`)
  }

  return (
    <div>
      {/* Page heading */}
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Start a training session
      </h2>
      <p className="text-gray-500 mb-8">
        Set your training details and duration, then record to generate quiz questions.
      </p>

      <form onSubmit={handleStart} className="space-y-6">

        {/* Topic */}
        <Field label="Training topic" required>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Fire Safety Induction"
            required
            className={inputClass}
          />
        </Field>

        {/* Session date */}
        <Field label="Date" required>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time" required>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label="End time" required>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
        </div>

        {/* Duration */}
        <Field label="Expected duration" required>
          <div className="grid grid-cols-3 gap-3">
            {['15', '20', '30'].map(min => (
              <button
                key={min}
                type="button"
                onClick={() => setDuration(min)}
                className={`py-2.5 px-4 rounded-xl font-medium transition-colors ${
                  duration === min
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {min} min
              </button>
            ))}
          </div>
        </Field>

        {/* Submit */}
        <button
          type="submit"
          disabled={!date || !startTime || !endTime || !topic || !duration}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
        >
          Start recording →
        </button>

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

function today() {
  return new Date().toISOString().split('T')[0]
}
