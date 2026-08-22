'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/lib/useAuth'
import { fetchAttempts, percent, type AttemptRow } from '@/lib/leaderboard'

function ParticipantHistoryInner({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAttempts()
      .then((rows) => setAttempts(rows.filter((a) => a.participant_id === params.id)))
      .catch((e) => setError(e.message))
  }, [params.id])

  if (error) {
    return (
      <div className="card p-4">
        <p className="text-sm text-ink">{error}</p>
      </div>
    )
  }

  if (!attempts) return <p className="text-muted py-10 text-center">Loading…</p>

  if (attempts.length === 0) {
    return (
      <div>
        <button
          onClick={() => router.push('/participants')}
          className="text-xs uppercase tracking-wide text-muted hover:text-ink mb-6"
        >
          ← All participants
        </button>
        <div className="card p-10 text-center">
          <h2 className="mb-2">Nothing to show</h2>
          <p className="text-muted text-sm">
            This person has no results on any quiz of yours.
          </p>
        </div>
      </div>
    )
  }

  const person = attempts[0].participants
  const percents = attempts.map(percent)
  const average = percents.reduce((s, p) => s + p, 0) / percents.length
  const best = Math.max(...percents)
  const passed = attempts.filter((a) => a.passed).length

  return (
    <div>
      <button
        onClick={() => router.push('/participants')}
        className="text-xs uppercase tracking-wide text-muted hover:text-ink mb-6"
      >
        ← All participants
      </button>

      <h1 className="text-3xl mb-1">{person?.name ?? attempts[0].participant_name}</h1>
      <p className="text-muted font-mono text-sm mb-8">{person?.eid ?? '—'}</p>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line mb-8">
        {[
          ['Quizzes taken', String(attempts.length)],
          ['Average', `${Math.round(average)}%`],
          ['Best', `${Math.round(best)}%`],
          ['Passed', `${passed} of ${attempts.length}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface p-4">
            <p className="eyebrow mb-1">{label}</p>
            <p className="text-ink text-lg">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg mb-4">History</h2>
      <div className="card divide-y divide-line">
        {attempts.map((a) => {
          const pct = Math.round(percent(a))
          return (
            <div key={a.id} className="flex items-center gap-4 p-5">
              <div className="flex-1 min-w-0">
                <p className="text-ink truncate">{a.sessions?.topic ?? 'Deleted session'}</p>
                <p className="text-xs text-muted mt-1">
                  {new Date(a.created_at).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-ink">
                  {a.score}/{a.total_questions}
                </p>
                <p className="text-xs text-muted">{pct}%</p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-1 border whitespace-nowrap shrink-0 ${
                  a.passed ? 'border-sand bg-sand-light text-sand-dark' : 'border-line text-muted'
                }`}
              >
                {a.passed ? 'Pass' : 'Fail'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ParticipantHistoryPage(props: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ParticipantHistoryInner {...props} />
    </RequireAuth>
  )
}
