'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const pad = (n: number) => String(n).padStart(2, '0')

// Local date/time — never toISOString(), which converts to UTC and can land
// on the wrong calendar day.
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m + minutes, 0, 0)
  return localTime(d)
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // session crosses midnight
  return diff
}

export default function HomePage() {
  const router = useRouter()

  // Start blank and fill in on mount. Seeding state with the current time
  // directly would differ between the prerendered HTML and the browser,
  // causing a React hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState(20)

  useEffect(() => {
    const now = new Date()
    const start = localTime(now)
    setDate(localDate(now))
    setStartTime(start)
    setEndTime(addMinutes(start, 20))
    setMounted(true)
  }, [])

  // Duration is the source of truth: changing it moves the end time.
  function handleDurationChange(minutes: number) {
    setDuration(minutes)
    setEndTime(addMinutes(startTime, minutes))
  }

  // Moving the start time keeps the duration and shifts the end time.
  function handleStartChange(value: string) {
    setStartTime(value)
    setEndTime(addMinutes(value, duration))
  }

  // Editing the end time directly re-derives the duration.
  function handleEndChange(value: string) {
    setEndTime(value)
    setDuration(minutesBetween(startTime, value))
  }

  function resetToNow() {
    const now = new Date()
    const start = localTime(now)
    setDate(localDate(now))
    setStartTime(start)
    setEndTime(addMinutes(start, duration))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) {
      alert('Please enter a topic')
      return
    }
    const params = new URLSearchParams({
      topic: topic.trim(),
      date,
      startTime,
      endTime,
      duration: String(duration),
    })
    router.push(`/recording?${params.toString()}`)
  }

  if (!mounted) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none'

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Create a Training Session</h1>
      <p className="text-gray-600 mb-8">
        Record your session and AI will generate quiz questions from what was said.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-semibold text-gray-900 mb-2">
            Topic
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Machine Learning Basics, Sales Training"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="date" className="block text-sm font-semibold text-gray-900">
              Date
            </label>
            <button
              type="button"
              onClick={resetToNow}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reset to now
            </button>
          </div>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-semibold text-gray-900 mb-2">
            Recording duration
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className={inputClass}
          >
            {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
            {![5, 10, 15, 20, 30, 45, 60, 90].includes(duration) && (
              <option value={duration}>{duration} minutes</option>
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startTime" className="block text-sm font-semibold text-gray-900 mb-2">
              Start time
            </label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => handleStartChange(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-semibold text-gray-900 mb-2">
              End time
            </label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => handleEndChange(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Times default to your device clock. Change the duration and the end time follows; edit the
          end time directly and the duration updates to match.
        </p>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base"
        >
          Continue to recording →
        </button>
      </form>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
        <ol className="text-sm text-blue-800 space-y-1">
          <li>1. Fill in the session details above</li>
          <li>2. Record your training audio — it stays on this device</li>
          <li>3. AI transcribes it and writes 10 quiz questions</li>
          <li>4. Review, edit, and publish the quiz</li>
        </ol>
      </div>
    </div>
  )
}
