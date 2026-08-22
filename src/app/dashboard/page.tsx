'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RequireAuth, useAuth } from '@/lib/useAuth'
import { sessionKey, deleteRecording } from '@/lib/recordings'
import Leaderboards from '../Leaderboards'
import type { Session } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-sand-light text-sand-dark border-sand',
  published: 'bg-sand-light text-muted border-sand',
  closed: 'bg-surface-subtle text-muted border-line',
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function remove(s: Session) {
    setDeletingId(s.id)
    setError(null)

    // Questions, attempts and answers all cascade from the session row.
    const { error: err } = await supabase.from('sessions').delete().eq('id', s.id)

    if (err) {
      setError(`Could not delete "${s.topic}": ${err.message}`)
      setDeletingId(null)
      setConfirmingId(null)
      return
    }

    // Free the audio still held on this device. Failure here is not worth
    // reporting — the session itself is already gone.
    try {
      await deleteRecording(sessionKey(s.session_date, s.topic))
    } catch {
      /* ignore */
    }

    setSessions((prev) => prev.filter((x) => x.id !== s.id))
    setDeletingId(null)
    setConfirmingId(null)
  }

  // Where a session should take you depends on how far it has got.
  function destinationFor(s: Session) {
    if (s.status === 'published') return `/session/${s.id}/share`
    if (s.status === 'closed') return `/session/${s.id}/results`
    return `/session/${s.id}/review`
  }

  return (
    <div>
      <div className="mb-10">
        <Leaderboards />
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl text-ink mb-1">Your sessions</h1>
          <p className="text-muted text-sm">{user?.email}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="bg-ink text-on-ink uppercase tracking-wide text-xs font-medium px-5 py-3 hover:opacity-90 transition-colors whitespace-nowrap"
        >
          + New session
        </button>
      </div>

      {error && (
        <div className="bg-surface-subtle border border-ink rounded-xl p-4 mb-6">
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-muted py-10 text-center">Loading your sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center">
          <h2 className="text-ink mb-2">No sessions yet</h2>
          <p className="text-muted text-sm mb-6">
            Record your first training session and AI will draft the quiz questions for you.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-ink text-on-ink uppercase tracking-wide text-xs font-medium px-6 py-3 hover:opacity-90 transition-colors"
          >
            Record a session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-surface border border-line rounded-xl overflow-hidden hover:border-ink transition-colors"
            >
              <div className="flex items-start gap-3 p-5">
                <button
                  onClick={() => router.push(destinationFor(s))}
                  className="flex-1 text-left min-w-0"
                >
                  <h3 className="text-ink truncate">{s.topic}</h3>
                  <p className="text-sm text-muted mt-1">
                    {new Date(`${s.session_date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {s.start_time && ` • ${s.start_time.slice(0, 5)}`}
                    {s.end_time && `–${s.end_time.slice(0, 5)}`}
                    {s.pass_threshold != null && ` • pass ${s.pass_threshold}%`}
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded border whitespace-nowrap ${
                      STATUS_STYLES[s.status] || STATUS_STYLES.closed
                    }`}
                  >
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  <button
                    onClick={() => setConfirmingId(confirmingId === s.id ? null : s.id)}
                    aria-label={`Delete ${s.topic}`}
                    className="text-muted hover:text-ink hover:bg-surface-subtle rounded-lg px-2 py-1 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {confirmingId === s.id && (
                <div className="border-t border-line bg-surface-subtle px-5 py-4">
                  <p className="text-sm text-ink mb-3">
                    Delete <strong>{s.topic}</strong>? Its questions
                    {s.status !== 'draft' && ' and every quiz result staff have submitted'} will be
                    removed too. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => remove(s)}
                      disabled={deletingId === s.id}
                      className="btn-danger"
                    >
                      {deletingId === s.id ? 'Deleting…' : 'Delete permanently'}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === s.id}
                      className="border border-ink text-ink uppercase tracking-wide text-xs font-medium px-5 py-3 hover:bg-ink hover:text-on-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
