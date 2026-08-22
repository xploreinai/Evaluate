import { supabase } from '@/lib/supabase'

// One attempt, with the person and the session it belongs to. Row-level
// security already limits these to the signed-in trainer's own sessions, so no
// extra filtering is needed here.
export interface AttemptRow {
  id: string
  session_id: string
  participant_id: string | null
  participant_name: string
  score: number | null
  total_questions: number | null
  passed: boolean | null
  created_at: string
  participants: { name: string; eid: string } | null
  sessions: { topic: string; session_date: string } | null
}

export interface ParticipantStats {
  participantId: string
  eid: string
  name: string
  attempts: number
  averagePercent: number
  bestPercent: number
  passRate: number       // share of attempts passed, 0–100
  lastAttempt: string
}

// A single attempt says little about consistency, so the scoring board only
// ranks people who have taken at least this many quizzes.
export const MIN_ATTEMPTS_FOR_CONSISTENCY = 2

export const percent = (a: AttemptRow) =>
  a.total_questions && a.total_questions > 0 ? ((a.score ?? 0) / a.total_questions) * 100 : 0

export async function fetchAttempts(): Promise<AttemptRow[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*, participants(name, eid), sessions(topic, session_date)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as AttemptRow[]
}

/** Collapse attempts into one row per person. */
export function aggregate(attempts: AttemptRow[]): ParticipantStats[] {
  const byPerson = new Map<string, AttemptRow[]>()

  for (const a of attempts) {
    // Attempts recorded before employee IDs existed have no participant; they
    // are left out rather than guessed at from a name that may not be unique.
    if (!a.participant_id) continue
    const list = byPerson.get(a.participant_id) || []
    list.push(a)
    byPerson.set(a.participant_id, list)
  }

  return Array.from(byPerson.entries()).map(([participantId, list]) => {
    const percents = list.map(percent)
    return {
      participantId,
      eid: list[0].participants?.eid ?? '—',
      name: list[0].participants?.name ?? list[0].participant_name,
      attempts: list.length,
      averagePercent: percents.reduce((s, p) => s + p, 0) / percents.length,
      bestPercent: Math.max(...percents),
      passRate: (list.filter((a) => a.passed).length / list.length) * 100,
      lastAttempt: list[0].created_at, // attempts arrive newest first
    }
  })
}

/** Most quizzes taken. Ties broken by the higher average. */
export function byVolume(stats: ParticipantStats[]): ParticipantStats[] {
  return [...stats].sort(
    (a, b) => b.attempts - a.attempts || b.averagePercent - a.averagePercent
  )
}

/** Best average score, among those with enough attempts to judge. */
export function byConsistency(stats: ParticipantStats[]): ParticipantStats[] {
  return stats
    .filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_CONSISTENCY)
    .sort((a, b) => b.averagePercent - a.averagePercent || b.attempts - a.attempts)
}
