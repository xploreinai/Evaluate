'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { questionOptions, isAnswerCorrect } from '@/types'
import type { Session, Question, OptionKey } from '@/types'

type Phase = 'identify' | 'quiz' | 'review'

const pad = (n: number) => String(n).padStart(2, '0')

export default function QuizPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('identify')
  const [eid, setEid] = useState('')
  const [name, setName] = useState('')
  const [participantId, setParticipantId] = useState<string | null>(null)

  // Nothing is chosen until the participant taps. A question with no entry
  // here renders with every option unselected.
  const [selections, setSelections] = useState<Record<string, OptionKey[]>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const submittedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data: s, error: sErr } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', params.id)
          .eq('status', 'published')
          .single()
        if (sErr) throw sErr

        const { data: q, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', params.id)
          .is('deleted_at', null)
          .order('created_at')
        if (qErr) throw qErr

        setSession(s)
        setQuestions(q || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [params.id])

  const submitQuiz = useCallback(
    async (finalSelections: Record<string, OptionKey[]>) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setIsSubmitting(true)

      try {
        let correctCount = 0
        questions.forEach((q) => {
          if (isAnswerCorrect(q, finalSelections[q.id] || [])) correctCount++
        })

        const threshold = session?.pass_threshold ?? 70
        const passed =
          questions.length > 0 ? (correctCount / questions.length) * 100 >= threshold : false

        // Generated here because participants may write an attempt but never
        // read one back, so the insert cannot return the row.
        const attemptId = crypto.randomUUID()

        const { error: aErr } = await supabase.from('quiz_attempts').insert({
          id: attemptId,
          session_id: params.id,
          participant_id: participantId,
          participant_name: name.trim(),
          score: correctCount,
          total_questions: questions.length,
          passed,
        })
        if (aErr) throw aErr

        const rows = questions.map((q) => {
          const chosen = finalSelections[q.id] || []
          return {
            attempt_id: attemptId,
            question_id: q.id,
            selected: chosen[0] ?? null,
            selected_keys: chosen,
            is_correct: isAnswerCorrect(q, chosen),
          }
        })
        const { error: ansErr } = await supabase.from('answers').insert(rows)
        if (ansErr) throw ansErr

        setResult({ score: correctCount, total: questions.length, passed })
        setPhase('review')
      } catch (err) {
        submittedRef.current = false
        setError(err instanceof Error ? err.message : 'Could not submit your answers')
      } finally {
        setIsSubmitting(false)
      }
    },
    [questions, session, params.id, participantId, name]
  )

  // Countdown, only when the trainer set a limit.
  useEffect(() => {
    if (phase !== 'quiz' || remaining === null) return
    if (remaining <= 0) {
      submitQuiz(selections)
      return
    }
    const id = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(id)
  }, [phase, remaining, selections, submitQuiz])

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!eid.trim() || !name.trim()) {
      setError('Please enter both your employee ID and your name.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('upsert_participant', {
        p_eid: eid.trim(),
        p_name: name.trim(),
      })
      if (rpcErr) throw rpcErr

      setParticipantId(data as string)
      if (session?.time_limit_seconds) setRemaining(session.time_limit_seconds)
      setPhase('quiz')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the quiz')
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleOption(question: Question, key: OptionKey) {
    setSelections((prev) => {
      const current = prev[question.id] || []
      if (question.multi) {
        // Checkbox behaviour: build up a set.
        return {
          ...prev,
          [question.id]: current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key],
        }
      }
      // Radio behaviour: tapping the chosen option again clears it.
      return { ...prev, [question.id]: current[0] === key ? [] : [key] }
    })
  }

  function goNext() {
    // Drop focus so the next question does not inherit the highlight from the
    // button that occupied the same position.
    ;(document.activeElement as HTMLElement | null)?.blur()
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1)
    else submitQuiz(selections)
  }

  function goBack() {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setCurrentIndex((i) => Math.max(0, i - 1))
  }

  if (isLoading) return <div className="text-center py-20 text-muted">Loading quiz…</div>

  if (error && phase !== 'quiz') {
    return (
      <div>
        <h2 className="text-2xl mb-4">Error</h2>
        <p className="text-sm text-ink bg-surface-subtle border border-ink p-4">{error}</p>
      </div>
    )
  }

  if (!session || questions.length === 0) {
    return <div className="text-center py-20 text-muted">This quiz is not available.</div>
  }

  // ── Identify ───────────────────────────────────────────────────────────────
  if (phase === 'identify') {
    return (
      <div className="max-w-md">
        <h1 className="text-3xl mb-2">{session.topic}</h1>
        <p className="text-muted mb-8">
          {questions.length} questions
          {session.time_limit_seconds
            ? ` • ${Math.round(session.time_limit_seconds / 60)} minute limit`
            : ' • no time limit'}
        </p>

        {error && (
          <div className="bg-surface-subtle border border-ink p-4 mb-6">
            <p className="text-sm text-ink">{error}</p>
          </div>
        )}

        <form onSubmit={handleIdentify} className="space-y-5">
          <div>
            <label htmlFor="eid" className="block text-sm font-semibold text-ink mb-2">
              Employee ID
            </label>
            <input
              id="eid"
              value={eid}
              onChange={(e) => setEid(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              placeholder="e.g. AD12345"
              className="field"
            />
            <p className="text-xs text-muted mt-1.5">
              Used to keep your training record together over time.
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-ink mb-2">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="field"
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Starting…' : 'Start quiz →'}
          </button>
        </form>
      </div>
    )
  }

  // ── Review, after submitting ───────────────────────────────────────────────
  if (phase === 'review' && result) {
    return (
      <div>
        <h1 className="text-3xl mb-2">Your answers</h1>
        <p className="text-muted mb-8">
          {session.topic} — review every question below. Your score is at the end.
        </p>

        <div className="space-y-6">
          {questions.map((q, idx) => {
            const chosen = selections[q.id] || []
            const correct = q.correct_keys?.length ? q.correct_keys : [q.correct]
            const gotItRight = isAnswerCorrect(q, chosen)

            return (
              <div key={q.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="eyebrow">Question {idx + 1}</p>
                  <span
                    className={`text-xs uppercase tracking-wide font-medium ${
                      gotItRight ? 'text-sand-dark' : 'text-ink'
                    }`}
                  >
                    {gotItRight ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <p className="text-ink mb-4">{q.question}</p>

                <div className="space-y-2">
                  {questionOptions(q).map((opt) => {
                    const isCorrect = correct.includes(opt.key)
                    const wasChosen = chosen.includes(opt.key)
                    return (
                      <div
                        key={opt.key}
                        className={`flex items-start gap-3 px-4 py-3 border ${
                          isCorrect
                            ? 'border-sand bg-sand-light'
                            : wasChosen
                              ? 'border-ink bg-surface-subtle'
                              : 'border-line'
                        }`}
                      >
                        <span className="font-mono text-sm uppercase text-muted w-4">{opt.key}</span>
                        <span className="flex-1 text-ink text-sm">{opt.text}</span>
                        <span className="text-xs whitespace-nowrap text-muted">
                          {isCorrect && 'Correct answer'}
                          {!isCorrect && wasChosen && 'Your answer'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {chosen.length === 0 && (
                  <p className="text-xs text-muted mt-3">You did not answer this question.</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Score last, so the review is read first */}
        <div className="card p-8 mt-8 text-center">
          <p className="eyebrow mb-3">Your result</p>
          <p className="text-5xl font-display text-ink mb-2">
            {result.score}/{result.total}
          </p>
          <p className="text-muted mb-4">
            {Math.round((result.score / result.total) * 100)}% — pass mark{' '}
            {session.pass_threshold}%
          </p>
          <p
            className={`inline-block px-4 py-2 border text-xs uppercase tracking-wide ${
              result.passed ? 'border-sand bg-sand-light text-sand-dark' : 'border-ink text-ink'
            }`}
          >
            {result.passed ? 'Passed' : 'Not passed'}
          </p>
          <p className="text-xs text-muted mt-6">
            Recorded against employee ID {eid.trim().toUpperCase()}.
          </p>
        </div>
      </div>
    )
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  const q = questions[currentIndex]
  const chosen = selections[q.id] || []
  const progress = ((currentIndex + 1) / questions.length) * 100
  const isLast = currentIndex === questions.length - 1

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">
            Question {currentIndex + 1} of {questions.length}
          </p>
          {remaining !== null ? (
            <p
              className={`text-sm font-mono ${remaining <= 30 ? 'text-ink font-bold' : 'text-muted'}`}
            >
              {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
            </p>
          ) : (
            <p className="text-sm text-muted">{Math.round(progress)}%</p>
          )}
        </div>
        <div className="w-full bg-surface-subtle h-1">
          <div className="bg-ink h-1 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && (
        <div className="bg-surface-subtle border border-ink p-4 mb-6">
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl text-ink mb-2">{q.question}</h2>
        <p className="eyebrow mb-6">
          {q.multi ? 'Select all that apply' : 'Select one answer'}
        </p>

        <div className="space-y-3">
          {questionOptions(q).map((opt) => {
            const selected = chosen.includes(opt.key)
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleOption(q, opt.key)}
                disabled={isSubmitting}
                aria-pressed={selected}
                className={`w-full border px-5 py-4 text-left transition-colors disabled:opacity-50 ${
                  selected
                    ? 'border-ink bg-surface-subtle'
                    : 'border-line bg-surface hover:border-ink'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-7 h-7 border flex items-center justify-center text-xs uppercase shrink-0 ${
                      q.multi ? '' : 'rounded'
                    } ${selected ? 'border-ink bg-ink text-on-ink' : 'border-line text-muted'}`}
                  >
                    {selected ? '✓' : opt.key}
                  </span>
                  <span className="flex-1 text-ink">{opt.text}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        {currentIndex > 0 && (
          <button onClick={goBack} disabled={isSubmitting} className="btn-secondary">
            ← Back
          </button>
        )}
        <button
          onClick={goNext}
          disabled={isSubmitting || chosen.length === 0}
          className="btn-primary"
        >
          {isSubmitting ? 'Submitting…' : isLast ? 'Submit answers' : 'Next →'}
        </button>
      </div>

      {chosen.length === 0 && (
        <p className="text-xs text-muted mt-3 text-center">
          Choose {q.multi ? 'at least one option' : 'an answer'} to continue.
        </p>
      )}
    </div>
  )
}
