'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/lib/useAuth'
import { fetchAttempts, aggregate, byVolume, type ParticipantStats } from '@/lib/leaderboard'

function ParticipantsInner() {
  const router = useRouter()
  const [stats, setStats] = useState<ParticipantStats[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchAttempts()
      .then((rows) => setStats(byVolume(aggregate(rows))))
      .catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    if (!stats) return []
    const q = query.trim().toLowerCase()
    if (!q) return stats
    return stats.filter(
      (s) => s.name.toLowerCase().includes(q) || s.eid.toLowerCase().includes(q)
    )
  }, [stats, query])

  return (
    <div>
      <h1 className="text-3xl mb-2">Participants</h1>
      <p className="text-muted mb-8">
        Everyone who has taken one of your quizzes, identified by employee ID.
      </p>

      {error && (
        <div className="card p-4 mb-6">
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or employee ID"
        className="field mb-6"
      />

      {!stats ? (
        <p className="text-muted py-10 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <h2 className="mb-2">{query ? 'No matches' : 'No participants yet'}</h2>
          <p className="text-muted text-sm">
            {query
              ? 'No one matches that name or employee ID.'
              : 'Once staff take a published quiz, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {filtered.map((s) => (
            <button
              key={s.participantId}
              onClick={() => router.push(`/participants/${s.participantId}`)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-surface-subtle transition-colors"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-ink truncate">{s.name}</span>
                <span className="block text-xs text-muted font-mono">{s.eid}</span>
              </span>
              <span className="text-right shrink-0 text-sm">
                <span className="block text-ink">
                  {s.attempts} {s.attempts === 1 ? 'quiz' : 'quizzes'}
                </span>
                <span className="block text-xs text-muted">
                  {Math.round(s.averagePercent)}% avg • {Math.round(s.passRate)}% passed
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ParticipantsPage() {
  return (
    <RequireAuth>
      <ParticipantsInner />
    </RequireAuth>
  )
}
