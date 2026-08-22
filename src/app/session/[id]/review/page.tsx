'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { questionOptions, optionColumns } from '@/types'
import type { Session, Question, OptionKey } from '@/types'
import { RequireAuth } from '@/lib/useAuth'


function ReviewPageInner({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)

  useEffect(() => {
    fetchSession()
  }, [params.id])

  async function fetchSession() {
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.id)
        .single()

      if (err) throw err
      setSession(data)

      // Questions are written by the upload step before we get here, so they
      // are always ready to load. ('ready' was a v1 status that no longer exists.)
      fetchQuestions()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
      setError(message)
      setIsLoading(false)
    }
  }

  async function fetchQuestions() {
    try {
      const { data, error: err } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', params.id)
        .is('deleted_at', null)
        .order('created_at')

      if (err) throw err
      setQuestions(data)
      setIsLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch questions'
      setError(message)
      setIsLoading(false)
    }
  }


  async function updateQuestion(questionId: string, updates: Partial<Question>) {
    try {
      const { error: err } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', questionId)

      if (err) throw err

      setQuestions(questions.map(q => q.id === questionId ? { ...q, ...updates } : q))
      setEditingQuestion(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update question'
      setError(message)
    }
  }

  async function deleteQuestion(questionId: string) {
    try {
      await updateQuestion(questionId, { deleted_at: new Date().toISOString() })
      setQuestions(questions.filter(q => q.id !== questionId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question'
      setError(message)
    }
  }

  async function updatePassThreshold(value: number) {
    // Update on screen first so the control stays responsive, then persist.
    setSession((prev) => (prev ? { ...prev, pass_threshold: value } : prev))

    const { error: err } = await supabase
      .from('sessions')
      .update({ pass_threshold: value })
      .eq('id', params.id)

    if (err) setError(`Could not save the pass mark: ${err.message}`)
  }

  async function updateTimeLimit(seconds: number | null) {
    setSession((prev) => (prev ? { ...prev, time_limit_seconds: seconds } : prev))

    const { error: err } = await supabase
      .from('sessions')
      .update({ time_limit_seconds: seconds })
      .eq('id', params.id)

    if (err) setError(`Could not save the time limit: ${err.message}`)
  }

  async function publishQuiz() {
    if (questions.length < 5) return

    setIsPublishing(true)
    try {
      const { error: err } = await supabase
        .from('sessions')
        .update({ status: 'published' })
        .eq('id', params.id)

      if (err) throw err

      router.push(`/session/${params.id}/share`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish quiz'
      setError(message)
      setIsPublishing(false)
    }
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl text-ink mb-4">Error</h2>
        <p className="text-sm text-ink bg-surface-subtle border border-ink rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    )
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4 animate-spin">⚙️</div>
        <h2 className="text-2xl text-ink mb-2">Loading your questions…</h2>
      </div>
    )
  }

  // Ready state
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl text-ink mb-1">
            Review your questions
          </h2>
          <p className="text-muted text-sm">
            {session.topic} • {new Date(session.session_date).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted mt-1">
            Minimum 5 to publish
          </p>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-6 mb-8">
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx + 1}
            isEditing={editingQuestion === q.id}
            onEdit={() => setEditingQuestion(q.id)}
            onSave={(updates) => updateQuestion(q.id, updates)}
            onDelete={() => deleteQuestion(q.id)}
            onCancel={() => setEditingQuestion(null)}
          />
        ))}
      </div>

      {/* Publish button */}
      {/* Pass mark */}
      <div className="bg-surface border border-line rounded-xl p-6 mb-6">
        <label htmlFor="passMark" className="block font-semibold text-ink mb-1">
          Pass mark
        </label>
        <p className="text-sm text-muted mb-4">
          How much of the quiz a participant must get right to pass.
        </p>
        <div className="flex items-center gap-3">
          <select
            id="passMark"
            value={session.pass_threshold ?? 70}
            onChange={(e) => updatePassThreshold(Number(e.target.value))}
            className="px-4 py-2.5 border border-line rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent outline-none"
          >
            {[40, 50, 60, 70, 80, 90, 100].map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">
            {questions.length > 0 && (
              <>
                {Math.ceil((questions.length * (session.pass_threshold ?? 70)) / 100)} of{' '}
                {questions.length} questions correct
              </>
            )}
          </span>
        </div>
      </div>

      {/* Time limit */}
      <div className="bg-surface border border-line rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <label htmlFor="timeLimit" className="block font-semibold text-ink">
            Time limit
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={session.time_limit_seconds !== null}
            onClick={() =>
              updateTimeLimit(session.time_limit_seconds === null ? 10 * 60 : null)
            }
            className={`relative w-11 h-6 border transition-colors shrink-0 ${
              session.time_limit_seconds !== null
                ? 'bg-ink border-ink'
                : 'bg-surface-subtle border-line'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 transition-transform duration-200 ${
                session.time_limit_seconds !== null
                  ? 'translate-x-[22px] bg-on-ink'
                  : 'translate-x-1 bg-ink'
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {session.time_limit_seconds === null
            ? 'Participants can take as long as they need.'
            : 'The quiz submits automatically when time runs out.'}
        </p>
        {session.time_limit_seconds !== null && (
          <select
            id="timeLimit"
            value={session.time_limit_seconds}
            onChange={(e) => updateTimeLimit(Number(e.target.value))}
            className="px-4 py-2.5 border border-line focus:ring-2 focus:ring-ink outline-none bg-surface text-ink"
          >
            {[2, 5, 10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m * 60}>
                {m} minutes
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={publishQuiz}
        disabled={questions.length < 5 || isPublishing}
        className="w-full btn-primary"
      >
        {isPublishing ? 'Publishing…' : 'Publish quiz →'}
      </button>
    </div>
  )
}

function QuestionCard({
  question,
  index,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: {
  question: Question
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: (updates: Partial<Question>) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [text, setText] = useState(question.question)
  const [options, setOptions] = useState(questionOptions(question))
  // Tick every option that counts as correct. More than one turns this into a
  // "select all that apply" question for participants.
  const [correctKeys, setCorrectKeys] = useState<OptionKey[]>(
    question.correct_keys?.length ? question.correct_keys : [question.correct]
  )

  function toggleCorrect(key: OptionKey) {
    setCorrectKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  if (isEditing) {
    return (
      <div className="bg-surface border border-line rounded-xl p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink mb-1.5">
            Question {index}
          </label>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full border border-line rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition"
          />
        </div>

        <div className="space-y-3 mb-6">
          {options.map((opt) => (
            <div key={opt.key} className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Option ${opt.key} is correct`}
                checked={correctKeys.includes(opt.key)}
                onChange={() => toggleCorrect(opt.key)}
                className="w-4 h-4 accent-black"
              />
              <input
                type="text"
                value={opt.text}
                onChange={e => {
                  setOptions(options.map(o => o.key === opt.key ? { ...o, text: e.target.value } : o))
                }}
                className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition"
              />
              <span className="text-sm font-medium text-muted w-6">{opt.key}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (correctKeys.length === 0) return
              onSave({
                question: text,
                ...optionColumns(options),
                correct_keys: correctKeys,
                multi: correctKeys.length > 1,
                correct: correctKeys[0],
              })
            }}
            className="flex-1 bg-ink text-on-ink uppercase tracking-wide text-xs font-medium py-2.5 hover:opacity-90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-ink text-ink uppercase tracking-wide text-xs font-medium py-2.5 hover:bg-ink hover:text-on-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-ink hover:bg-surface-subtle rounded-lg transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted mb-1">Question {index}</p>
          <p className="text-lg font-medium text-ink">{question.question}</p>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm text-ink hover:bg-surface-subtle rounded-lg transition-colors font-medium"
        >
          Edit
        </button>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const isCorrect = correctKeys.includes(opt.key)
          return (
            <div
              key={opt.key}
              className={`flex items-center gap-3 px-4 py-3 border ${
                isCorrect ? 'bg-sand-light border-sand' : 'bg-surface-subtle border-line'
              }`}
            >
              <span className={`font-mono text-sm uppercase ${isCorrect ? 'text-ink' : 'text-muted'}`}>
                {opt.key}
              </span>
              <span className="flex-1 text-ink">{opt.text}</span>
              {isCorrect && <span className="text-xs text-sand-dark">✓ Correct</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}


export default function ReviewPage(props: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ReviewPageInner {...props} />
    </RequireAuth>
  )
}
