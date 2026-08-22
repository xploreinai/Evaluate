'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchAttempts,
  aggregate,
  byVolume,
  byConsistency,
  MIN_ATTEMPTS_FOR_CONSISTENCY,
  type ParticipantStats,
} from '@/lib/leaderboard'

type Board = 'volume' | 'consistency'

export default function Leaderboards({ limit = 5 }: { limit?: number }) {
  const router = useRouter()
  const [stats, setStats] = useState<ParticipantStats[] | null>(null)
  const [board, setBoard] = useState<Board>('volume')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAttempts()
      .then((rows) => setStats(aggregate(rows)))
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="card p-5">
        <p className="text-sm text-ink">Could not load the leaderboard: {error}</p>
      </div>
    )
  }

  if (!stats) return <p className="text-sm text-muted py-6">Loading leaderboard…</p>

  const ranked = board === 'volume' ? byVolume(stats) : byConsistency(stats)
  const shown = ranked.slice(0, limit)

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 p-5 border-b border-line">
        <h2 className="text-lg">Leaderboard</h2>
        <div className="flex border border-line">
          {(
            [
              ['volume', 'Most taken'],
              ['consistency', 'Best average'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setBoard(key)}
              className={`text-[11px] uppercase tracking-wide px-3 py-2 transition-colors ${
                board === key ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted p-5">
          {board === 'consistency'
            ? `No one has taken ${MIN_ATTEMPTS_FOR_CONSISTENCY} quizzes yet, so there is nothing to compare.`
            : 'No quiz results yet.'}
        </p>
      ) : (
        <ul>
          {shown.map((s, i) => (
            <li key={s.participantId} className="border-b border-line last:border-0">
              <button
                onClick={() => router.push(`/participants/${s.participantId}`)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-subtle transition-colors"
              >
                <span className="font-display text-lg text-muted w-6 shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-ink truncate">{s.name}</span>
                  <span className="block text-xs text-muted font-mono">{s.eid}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-ink">
                    {board === 'volume'
                      ? `${s.attempts} ${s.attempts === 1 ? 'quiz' : 'quizzes'}`
                      : `${Math.round(s.averagePercent)}%`}
                  </span>
                  <span className="block text-xs text-muted">
                    {board === 'volume'
                      ? `${Math.round(s.averagePercent)}% average`
                      : `over ${s.attempts} quizzes`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="p-4 border-t border-line">
        <button
          onClick={() => router.push('/participants')}
          className="text-xs uppercase tracking-wide text-ink hover:text-sand-dark transition-colors"
        >
          All participants →
        </button>
      </div>
    </div>
  )
}
