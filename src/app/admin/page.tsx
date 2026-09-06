'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RequireAuth } from '@/lib/useAuth'
import { errorMessage } from '@/lib/errors'

interface TrainerRow {
  user_id: string
  email: string
  full_name: string | null
  role: string
  property: string | null
  signed_up_at: string
  last_sign_in_at: string | null
  sessions_created: number
  sessions_published: number
  questions_generated: number
  attempts_taken: number
  last_activity: string | null
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  org_admin: 'Property admin',
  trainer: 'Trainer',
}

// "3 days ago" reads faster than a date when the question is "are they using it".
function since(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'A month ago' : `${months} months ago`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function AdminContent() {
  const [rows, setRows] = useState<TrainerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase.rpc('admin_trainer_overview')

    if (err) {
      // Deployed before the migrations are run, the function simply does not
      // exist yet. That is a setup step, not a fault worth alarming anyone with.
      const code = (err as { code?: string }).code
      if (code === '42883' || /does not exist/i.test(err.message || '')) {
        setNotReady(true)
      } else {
        setError(errorMessage(err, 'Could not load the administration view'))
      }
    } else {
      setRows((data as TrainerRow[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="text-muted py-10 text-center">Loading…</p>
  }

  if (notReady) {
    return (
      <div>
        <h1 className="text-3xl text-ink mb-1">Administration</h1>
        <div className="border border-ink bg-surface-subtle p-5 mt-8">
          <p className="text-sm text-ink mb-2">Not set up yet.</p>
          <p className="text-sm text-muted">
            Run <code>009_multi_property.sql</code> and then{' '}
            <code>010_admin_overview.sql</code> in the Supabase SQL editor, then reload
            this page.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl text-ink mb-1">Administration</h1>
        <div className="border border-ink bg-surface-subtle p-5 mt-8">
          <p className="text-sm text-ink">{error}</p>
        </div>
      </div>
    )
  }

  const active = rows.filter((r) => r.sessions_created > 0).length
  const dormant = rows.length - active

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-ink mb-1">Administration</h1>
        <p className="text-muted text-sm">
          Everyone who has signed up, newest first — and whether they have actually
          used it.
        </p>
      </div>

      <div className="grid grid-cols-3 border-t border-b border-line mb-8">
        <div className="px-4 py-4 border-r border-line">
          <div className="text-2xl text-ink tabular-nums">{rows.length}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-1">
            Accounts
          </div>
        </div>
        <div className="px-4 py-4 border-r border-line">
          <div className="text-2xl text-ink tabular-nums">{active}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-1">
            Have recorded
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="text-2xl text-ink tabular-nums">{dormant}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-1">
            Signed up, never used
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted py-10 text-center">Nobody has signed up yet.</p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-sm min-w-[46rem]">
            <thead>
              <tr className="bg-surface-subtle">
                {[
                  'Person',
                  'Signed up',
                  'Last seen',
                  'Sessions',
                  'Live',
                  'Questions',
                  'Attempts',
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-muted font-medium border-b border-line whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="text-ink">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted">
                      {r.full_name ? `${r.email} · ` : ''}
                      {ROLE_LABELS[r.role] || r.role}
                      {r.property ? ` · ${r.property}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {shortDate(r.signed_up_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        r.last_sign_in_at ? 'text-ink' : 'text-muted italic'
                      }
                    >
                      {since(r.last_sign_in_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink tabular-nums">
                    {r.sessions_created}
                  </td>
                  <td className="px-4 py-3 text-ink tabular-nums">
                    {r.sessions_published}
                  </td>
                  <td className="px-4 py-3 text-ink tabular-nums">
                    {r.questions_generated}
                  </td>
                  <td className="px-4 py-3 text-ink tabular-nums">
                    {r.attempts_taken}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted mt-4">
        &ldquo;Last seen&rdquo; is the last time they signed in. &ldquo;Attempts&rdquo;
        counts quizzes taken by staff on that trainer&rsquo;s sessions.
      </p>
    </div>
  )
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  )
}
