'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RequireAuth, useAuth } from '@/lib/useAuth'
import type { Session } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft — not yet shared',
  published: 'Live',
  closed: 'Closed',
}

function DashboardContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setSessions(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Where a session should take you depends on how far it has got.
  function destinationFor(s: Session) {
    if (s.status === 'published') return `/session/${s.id}/share`
    if (s.status === 'closed') return `/session/${s.id}/results`
    return `/session/${s.id}/review`
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Your sessions</h1>
          <p className="text-gray-600 text-sm">{user?.email}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
        >
          + New session
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 py-10 text-center">Loading your sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <h2 className="font-semibold text-gray-900 mb-2">No sessions yet</h2>
          <p className="text-gray-600 text-sm mb-6">
            Record your first training session and AI will draft the quiz questions for you.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Record a session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(destinationFor(s))}
              className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{s.topic}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(`${s.session_date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {s.start_time && ` • ${s.start_time.slice(0, 5)}`}
                    {s.end_time && `–${s.end_time.slice(0, 5)}`}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${
                    STATUS_STYLES[s.status] || STATUS_STYLES.closed
                  }`}
                >
                  {STATUS_LABELS[s.status] || s.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  )
}
